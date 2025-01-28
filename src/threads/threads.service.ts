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

import { Loaded } from '@mikro-orm/core';
import dayjs from 'dayjs';

import { ThreadCreateBody, ThreadCreateResponse } from './dtos/thread-create.js';
import { Thread } from './thread.entity.js';
import { ThreadsListQuery, ThreadsListResponse } from './dtos/threads-list.js';
import { ThreadReadParams, ThreadReadResponse } from './dtos/thread-read.js';
import type { Thread as ThreadDto } from './dtos/thread.js';
import {
  ThreadUpdateBody,
  ThreadUpdateParams,
  ThreadUpdateResponse
} from './dtos/thread-update.js';
import { ThreadDeleteParams, ThreadDeleteResponse } from './dtos/thread-delete.js';

import { ORM } from '@/database.js';
import { createPaginatedResponse, getListCursor } from '@/utils/pagination.js';
import { createToolResources, toToolResourcesDto } from '@/tools/tools.service.js';
import { getUpdatedValue } from '@/utils/update.js';
import { createDeleteResponse } from '@/utils/delete.js';
import { File } from '@/files/entities/file.entity.js';
import { VectorStore } from '@/vector-stores/entities/vector-store.entity.js';
import { deleteFile } from '@/files/files.service.js';
import { deleteVectorStore } from '@/vector-stores/vector-stores.service.js';
import { createMessageEntity } from '@/messages/messages.service.js';

function toDto(thread: Loaded<Thread>): ThreadDto {
  return {
    id: thread.id,
    object: 'thread',
    metadata: thread.metadata ?? {},
    created_at: dayjs(thread.createdAt).unix(),
    tool_resources: toToolResourcesDto(thread.toolResources)
  };
}

export async function createThread({
  messages,
  metadata,
  tool_resources
}: ThreadCreateBody): Promise<ThreadCreateResponse> {
  const thread = new Thread({
    toolResources: await createToolResources(tool_resources),
    metadata: metadata ?? undefined
  });
  ORM.em.persist(thread);
  const threadMessages = await Promise.all(
    (messages ?? []).map(async (message, idx) =>
      createMessageEntity({ thread_id: thread.id, ...message, order: idx })
    )
  );

  await ORM.em.persistAndFlush(threadMessages);
  return toDto(thread);
}

export async function updateThread({
  thread_id,
  metadata,
  tool_resources
}: ThreadUpdateParams & ThreadUpdateBody): Promise<ThreadUpdateResponse> {
  const thread = await ORM.em.getRepository(Thread).findOneOrFail({
    id: thread_id
  });
  thread.toolResources = getUpdatedValue(
    await createToolResources(tool_resources),
    thread.toolResources
  );
  thread.metadata = getUpdatedValue(metadata, thread.metadata);
  await ORM.em.flush();
  return toDto(thread);
}

export async function readThread({ thread_id }: ThreadReadParams): Promise<ThreadReadResponse> {
  const thread = await ORM.em.getRepository(Thread).findOneOrFail({ id: thread_id });
  return toDto(thread);
}

export async function listThreads({
  limit,
  after,
  before,
  order,
  order_by
}: ThreadsListQuery): Promise<ThreadsListResponse> {
  const repo = ORM.em.getRepository(Thread);
  const cursor = await getListCursor<Thread>({}, { limit, order, order_by, after, before }, repo);
  return createPaginatedResponse(cursor, toDto);
}

export async function deleteThread({
  thread_id
}: ThreadDeleteParams): Promise<ThreadDeleteResponse> {
  const thread = await ORM.em.getRepository(Thread).findOneOrFail({ id: thread_id });

  // delete dependent entities
  const files = await ORM.em.getRepository(File).find({ dependsOn: thread.id });
  await Promise.all(files.map((file) => deleteFile({ file_id: file.id })));

  const vectorStores = await ORM.em.getRepository(VectorStore).find({ dependsOn: thread.id });
  await Promise.all(
    vectorStores.map((vectorStore) => deleteVectorStore({ vector_store_id: vectorStore.id }))
  );

  thread.delete();
  await ORM.em.flush();

  return createDeleteResponse(thread_id, 'thread');
}
