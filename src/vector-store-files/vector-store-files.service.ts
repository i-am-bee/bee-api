/**
 * Copyright 2024 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ref, RequestContext } from '@mikro-orm/core';
import { Loaded } from '@mikro-orm/mongodb';

import { VectorStoreFile, VectorStoreFileStatus } from './entities/vector-store-file.entity.js';

import { File } from '@/files/entities/file.entity.js';
import { VectorStoreFile as VectorStoreFileDto } from '@/vector-store-files/dtos/vector-store-file.js';
import {
  VectorStoreFileReadParams,
  VectorStoreFileReadResponse
} from '@/vector-store-files/dtos/vector-store-file-read.js';
import {
  VectorStoreFilesListParams,
  VectorStoreFilesListQuery,
  VectorStoreFilesListResponse
} from '@/vector-store-files/dtos/vector-store-file-list.js';
import {
  VectorStoreFileCreateBody,
  VectorStoreFileCreateParams,
  VectorStoreFileCreateResponse
} from '@/vector-store-files/dtos/vector-store-file-create.js';
import {
  VectorStoreFileDeleteParams,
  VectorStoreFileDeleteResponse
} from '@/vector-store-files/dtos/vector-store-file-delete.js';
import { ORM } from '@/database.js';
import { createPaginatedResponse, getListCursor } from '@/utils/pagination.js';
import { APIError, APIErrorCode } from '@/errors/error.entity.js';
import { createDeleteResponse } from '@/utils/delete.js';
import { VectorStore } from '@/vector-stores/entities/vector-store.entity.js';
import { getVectorStoreClient } from '@/vector-store-files/execution/client.js';
import { queue } from '@/vector-store-files/queues/process-file.queue.js';
import { determineChunkingStrategy } from '@/vector-store-files/utils/determineChunkingStrategy.js';
import { getServiceLogger } from '@/logger.js';
import { toErrorDto } from '@/errors/plugin.js';
import { QueueName } from '@/jobs/constants.js';
import { getProjectPrincipal } from '@/administration/helpers.js';
import { VECTOR_STORE_FILE_QUOTA_DAILY } from '@/config.js';
import { dayjs, getLatestDailyFixedTime } from '@/utils/datetime.js';
import { updateRateLimitHeadersWithDailyQuota } from '@/utils/rate-limit.js';

const getFileLogger = (vectorStoreFileIds?: string[]) =>
  getServiceLogger('vector-store-files').child({ vectorStoreFileIds });

export async function assertVectorStoreFilesQuota(newFilesCount = 1) {
  const count = await ORM.em.getRepository(VectorStoreFile).count({
    createdBy: getProjectPrincipal(),
    createdAt: { $gte: getLatestDailyFixedTime().toDate() }
  });
  updateRateLimitHeadersWithDailyQuota({ quota: VECTOR_STORE_FILE_QUOTA_DAILY, used: count });
  if (count + newFilesCount > VECTOR_STORE_FILE_QUOTA_DAILY) {
    throw new APIError({
      message: 'Your daily vector store file quota has been exceeded',
      code: APIErrorCode.TOO_MANY_REQUESTS
    });
  }
}

export function toDto(vectorStoreFile: VectorStoreFile): VectorStoreFileDto {
  const { file, status, vectorStore, lastError, usageBytes } = vectorStoreFile;
  return {
    // The ID returned to frontend is file ID. Unique Identifier is a pair (vectorStore, fileId)
    id: file.id,
    object: 'vector_store.file',
    usage_bytes: usageBytes,
    status: status == 'cancelling' ? 'cancelled' : status,
    vector_store_id: vectorStore.id,
    last_error: lastError ? toErrorDto(lastError) : null,
    created_at: dayjs(vectorStoreFile.createdAt).unix()
  };
}

export async function listVectorStoreFiles({
  vector_store_id,
  limit,
  order,
  order_by,
  after,
  before
}: VectorStoreFilesListParams & VectorStoreFilesListQuery): Promise<VectorStoreFilesListResponse> {
  await ORM.em // check if VectorStore exists
    .getRepository(VectorStore)
    .findOneOrFail({ id: vector_store_id });

  const repo = ORM.em.getRepository(VectorStoreFile);
  const cursor = await getListCursor<VectorStoreFile>(
    { vectorStore: vector_store_id },
    { limit, order, order_by, after, before },
    repo
  );
  return createPaginatedResponse(cursor, toDto);
}

export async function createVectorStoreFile({
  vector_store_id,
  ...body
}: VectorStoreFileCreateParams &
  VectorStoreFileCreateBody): Promise<VectorStoreFileCreateResponse> {
  const vectorStore = await ORM.em
    .getRepository(VectorStore)
    .findOneOrFail({ id: vector_store_id });

  if (vectorStore.expired) {
    throw new APIError({ message: 'Vector store is expired', code: APIErrorCode.INVALID_INPUT });
  }

  await assertVectorStoreFilesQuota();

  const file = await ORM.em.getRepository(File).findOneOrFail({ id: body.file_id });

  const vectorStoreFile = new VectorStoreFile({
    file: ref(file),
    vectorStore: ref(vectorStore),
    chunkingStrategy: determineChunkingStrategy(body.chunking_strategy),
    dependsOn: vectorStore.dependsOn
  });

  await ORM.em.persistAndFlush(vectorStoreFile);
  await queue.add(
    QueueName.VECTOR_STORES_FILE_PROCESSOR,
    { vectorStoreFileId: vectorStoreFile.id },
    { jobId: vectorStoreFile.id }
  );
  return toDto(vectorStoreFile);
}

export async function readVectorStoreFile({
  vector_store_id,
  file_id
}: VectorStoreFileReadParams): Promise<VectorStoreFileReadResponse> {
  const vectorStoreFile = await ORM.em.getRepository(VectorStoreFile).findOneOrFail({
    vectorStore: vector_store_id,
    file: file_id
  });
  return toDto(vectorStoreFile);
}

export async function deleteVectorStoreFile({
  file_id,
  vector_store_id
}: VectorStoreFileDeleteParams): Promise<VectorStoreFileDeleteResponse> {
  const vectorStoreFile = await ORM.em.getRepository(VectorStoreFile).findOneOrFail({
    vectorStore: vector_store_id,
    file: file_id
  });
  await deleteVectorStoreFiles([vectorStoreFile]);
  await ORM.em.flush();
  return createDeleteResponse(file_id, 'vectorStoreFile');
}

export async function deleteVectorStoreFiles(vectorStoreFiles: Loaded<VectorStoreFile>[]) {
  const vectorStoreFileIds = vectorStoreFiles.map((f) => f.id);
  await Promise.all(vectorStoreFileIds.map((vectorStoreFileId) => queue.remove(vectorStoreFileId)));

  const cleanupVectorDb = async () => {
    RequestContext.create(ORM.em, async () => {
      try {
        await getVectorStoreClient().dropVectorStoreFiles(vectorStoreFiles.map((f) => f.id));
        for (const vectorStoreFile of vectorStoreFiles) {
          vectorStoreFile.usageBytes = 0;
        }
        await ORM.em.flush();
      } catch (err) {
        getFileLogger(vectorStoreFileIds).warn(
          { err },
          'Could not delete vector store files from vector db.'
        );
      }
    });
  };
  cleanupVectorDb(); // clean up vector db in the background

  for (const vectorStoreFile of vectorStoreFiles) {
    vectorStoreFile.delete();
    if (vectorStoreFile.status === VectorStoreFileStatus.IN_PROGRESS) {
      vectorStoreFile.status = VectorStoreFileStatus.CANCELLING;
    }
  }
}
