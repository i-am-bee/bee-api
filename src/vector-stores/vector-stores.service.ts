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

import { FilterQuery, ref } from '@mikro-orm/core';
import dayjs from 'dayjs';
import { omit, sum } from 'remeda';

import { VectorStore } from './entities/vector-store.entity.js';

import { VectorStore as VectorStoreDto } from '@/vector-stores/dtos/vector-store.js';
import { File } from '@/files/entities/file.entity.js';
import {
  VectorStoreReadParams,
  VectorStoreReadResponse
} from '@/vector-stores/dtos/vector-store-read.js';
import {
  VectorStoresListQuery,
  VectorStoresListResponse
} from '@/vector-stores/dtos/vector-store-list.js';
import {
  VectorStoreCreateBody,
  VectorStoreCreateResponse
} from '@/vector-stores/dtos/vector-store-create.js';
import {
  VectorStoreUpdateBody,
  VectorStoreUpdateParams,
  VectorStoreUpdateResponse
} from '@/vector-stores/dtos/vector-store-update.js';
import {
  VectorStoreDeleteParams,
  VectorStoreDeleteResponse
} from '@/vector-stores/dtos/vector-store-delete.js';
import { ORM } from '@/database.js';
import { createPaginatedResponse, getListCursor } from '@/utils/pagination.js';
import { APIError, APIErrorCode } from '@/errors/error.entity.js';
import { createDeleteResponse } from '@/utils/delete.js';
import {
  VectorStoreFile,
  VectorStoreFileStatus
} from '@/vector-store-files/entities/vector-store-file.entity.js';
import { queue } from '@/vector-store-files/queues/process-file.queue.js';
import { getServiceLogger } from '@/logger.js';
import { getUpdatedValue } from '@/utils/update.js';
import { VectorStoreExpirationAfter } from '@/vector-stores/entities/vector-store-expiration-after.entity.js';
import { determineChunkingStrategy } from '@/vector-store-files/utils/determineChunkingStrategy.js';
import { QueueName } from '@/jobs/constants.js';
import {
  assertVectorStoreFilesQuota,
  deleteVectorStoreFiles
} from '@/vector-store-files/vector-store-files.service.js';
import { Thread } from '@/threads/thread.entity.js';

const getVectorStoreLogger = (vectorStoreId?: string, vectorStoreFileId?: string) =>
  getServiceLogger('vectorStore').child({ vectorStoreId, vectorStoreFileId });

type VectorStoreFileCounts = { [status in VectorStoreFileStatus]: number };
type VectorStoreFileStats = { fileCounts: VectorStoreFileCounts; usageBytes: number };

export function toDto(vectorStore: VectorStore, fileStats: VectorStoreFileStats): VectorStoreDto {
  const fileCounts = fileStats.fileCounts;
  const fileProcessingStatus = fileCounts['in_progress'] > 0 ? 'in_progress' : 'completed';
  return {
    id: vectorStore.id,
    object: 'vector_store',
    metadata: vectorStore.metadata ?? {},
    status: vectorStore.expired ? 'expired' : fileProcessingStatus,
    file_counts: {
      cancelled: fileCounts.cancelled + fileCounts.cancelling,
      ...omit(fileCounts, ['cancelled', 'cancelling']),
      total: sum(Object.values(fileCounts))
    },
    name: vectorStore.name,
    usage_bytes: fileStats.usageBytes,
    expires_after: vectorStore.expiresAfter ? { ...vectorStore.expiresAfter } : undefined,
    expires_at: vectorStore.expiresAt && dayjs(vectorStore.expiresAt).unix(),
    last_active_at: vectorStore.lastActiveAt && dayjs(vectorStore.lastActiveAt).unix(),
    created_at: dayjs(vectorStore.createdAt).unix(),
    description: vectorStore.description,
    depends_on: vectorStore.dependsOn
      ? {
          thread: {
            id: vectorStore.dependsOn.id
          }
        }
      : undefined
  };
}

async function getFileStats(vectorStores: VectorStore[]): Promise<VectorStoreFileStats[]> {
  const vectorStoreIds = vectorStores.map((v) => v.id);
  const fileCountAggregationResult = await ORM.em.aggregate(VectorStoreFile, [
    { $match: { vectorStore: { $in: vectorStoreIds }, deletedAt: null } },
    { $group: { _id: { vectorStore: '$vectorStore', status: '$status' }, count: { $sum: 1 } } },
    { $project: { _id: 0, vectorStore: '$_id.vectorStore', status: '$_id.status', count: 1 } }
  ]);
  const fileCounts = Object.fromEntries(
    vectorStores.map((vectorStore) => [
      vectorStore.id,
      { in_progress: 0, completed: 0, cancelled: 0, cancelling: 0, failed: 0 }
    ])
  );
  for (const group of fileCountAggregationResult) {
    fileCounts[group.vectorStore.toString()][group.status as VectorStoreFileStatus] += group.count;
  }
  const usageBytes: Record<string, number> = {};

  const fileUsageAggregationResult = await ORM.em.aggregate(VectorStoreFile, [
    { $match: { vectorStore: { $in: vectorStoreIds }, deletedAt: null } },
    { $group: { _id: { vectorStore: '$vectorStore' }, sum: { $sum: '$usageBytes' } } },
    { $project: { _id: 0, vectorStore: '$_id.vectorStore', sum: '$sum' } }
  ]);
  for (const group of fileUsageAggregationResult) {
    usageBytes[group.vectorStore.toString()] = group.sum;
  }

  return vectorStores.map((vectorStore) => ({
    fileCounts: fileCounts[vectorStore.id],
    usageBytes: usageBytes[vectorStore.id] ?? 0
  }));
}

export async function listVectorStores({
  limit,
  order,
  order_by,
  after,
  before,
  search,
  show_dependent
}: VectorStoresListQuery): Promise<VectorStoresListResponse> {
  const where: FilterQuery<VectorStore> = {};

  if (search) {
    where.name = new RegExp(search, 'i');
  }

  if (!show_dependent) {
    where.dependsOn = { $exists: false };
  }

  const repo = ORM.em.getRepository(VectorStore);
  const cursor = await getListCursor<VectorStore>(
    where,
    { limit, order, order_by, after, before },
    repo
  );
  const vectorStores = cursor.items;
  const fileCounts = await getFileStats(cursor.items);
  const fileStatsRecord: Record<`${(typeof vectorStores)[number]['id']}`, VectorStoreFileStats> =
    Object.fromEntries(vectorStores.map((vFile, idx) => [vFile.id, fileCounts[idx]]));

  return createPaginatedResponse(cursor, (vectorStoreFile) =>
    toDto(vectorStoreFile, fileStatsRecord[vectorStoreFile.id])
  );
}

export async function createVectorStore(
  body: VectorStoreCreateBody
): Promise<VectorStoreCreateResponse> {
  const files = await ORM.em.getRepository(File).find({ id: { $in: body.file_ids ?? [] } });
  if (files.length !== (body.file_ids?.length ?? 0)) {
    throw new APIError({ message: 'Some file not found', code: APIErrorCode.INVALID_INPUT });
  }
  const dependsOn = body.depends_on
    ? ref(await ORM.em.getRepository(Thread).findOneOrFail({ id: body.depends_on.thread.id }))
    : undefined;

  await assertVectorStoreFilesQuota(files.length);

  const vectorStore = new VectorStore({
    name: body.name ?? 'Vector store',
    expiresAfter: body.expires_after && new VectorStoreExpirationAfter(body.expires_after),
    dependsOn
  });
  const vectorStoreFiles = files.map(
    (file) =>
      new VectorStoreFile({
        file: ref(file),
        vectorStore: ref(vectorStore),
        chunkingStrategy: determineChunkingStrategy(body.chunking_strategy)
      })
  );
  vectorStore.files.add(vectorStoreFiles);
  // TODO: This is not atomic and can break in the middle (saving vector store and not files)
  // This will fail the request, but leave entities behind, should we add support for transactions?
  await ORM.em.persistAndFlush([vectorStore, ...vectorStoreFiles]);
  try {
    for (const vectorStoreFile of vectorStoreFiles) {
      try {
        await queue.add(
          QueueName.VECTOR_STORES_FILE_PROCESSOR,
          { vectorStoreFileId: vectorStoreFile.id },
          { jobId: vectorStoreFile.id }
        );
      } catch (err) {
        getVectorStoreLogger(vectorStore.id, vectorStoreFile.id).error(
          { err },
          'Failed to create vector store file job'
        );
        vectorStoreFile.status = VectorStoreFileStatus.FAILED;
      }
    }
  } catch (error) {
    await ORM.em.removeAndFlush([vectorStore, ...vectorStoreFiles]);
    throw error;
  } finally {
    await ORM.em.flush();
  }
  const in_progress = vectorStoreFiles.length;
  const fileCounts = { in_progress, completed: 0, cancelled: 0, cancelling: 0, failed: 0 };
  return toDto(vectorStore, { fileCounts, usageBytes: 0 });
}

export async function updateVectorStore({
  vector_store_id,
  ...body
}: VectorStoreUpdateBody & VectorStoreUpdateParams): Promise<VectorStoreUpdateResponse> {
  const vectorStore = await ORM.em
    .getRepository(VectorStore)
    .findOneOrFail({ id: vector_store_id });

  if (vectorStore.expired) {
    throw new APIError({ message: 'Vector store is expired', code: APIErrorCode.INVALID_INPUT });
  }

  const { name, expires_after, metadata } = body;

  vectorStore.name = getUpdatedValue(name, vectorStore.name);
  vectorStore.metadata = getUpdatedValue(metadata, vectorStore.metadata);
  vectorStore.expiresAfter = getUpdatedValue(
    expires_after && new VectorStoreExpirationAfter(expires_after),
    vectorStore.expiresAfter
  );
  await ORM.em.flush();
  const [fileCounts] = await getFileStats([vectorStore]);
  return toDto(vectorStore, fileCounts);
}

export async function readVectorStore({
  vector_store_id
}: VectorStoreReadParams): Promise<VectorStoreReadResponse> {
  const vectorStore = await ORM.em
    .getRepository(VectorStore)
    .findOneOrFail({ id: vector_store_id });
  const [fileCounts] = await getFileStats([vectorStore]);
  return toDto(vectorStore, fileCounts);
}

export async function deleteVectorStore({
  vector_store_id
}: VectorStoreDeleteParams): Promise<VectorStoreDeleteResponse> {
  const vectorStore = await ORM.em
    .getRepository(VectorStore)
    .findOneOrFail({ id: vector_store_id }, { populate: ['files'] });

  vectorStore.delete();
  await deleteVectorStoreFiles(vectorStore.files.slice());
  await ORM.em.flush();
  return createDeleteResponse(vector_store_id, 'vectorStore');
}
