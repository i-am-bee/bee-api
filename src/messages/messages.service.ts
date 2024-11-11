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

import { Loaded, ref } from '@mikro-orm/core';
import dayjs from 'dayjs';
import { isNonNullish, unique } from 'remeda';

import { Message } from './message.entity.js';
import {
  MessageCreateBody,
  MessageCreateParams,
  MessageCreateResponse
} from './dtos/message-create.js';
import { MessageReadParams, MessageReadResponse } from './dtos/message-read.js';
import {
  MessagesListParams,
  MessagesListQuery,
  MessagesListResponse
} from './dtos/messages-list.js';
import type { Message as MessageDto } from './dtos/message.js';
import {
  MessageUpdateBody,
  MessageUpdateParams,
  MessageUpdateResponse
} from './dtos/message-update.js';
import { MessageDeleteParams, MessageDeleteResponse } from './dtos/message-delete.js';
import { Attachment, attachmentTypes } from './attachment.entity.js';

import { Thread } from '@/threads/thread.entity.js';
import { ORM } from '@/database.js';
import { createPaginatedResponse } from '@/utils/pagination.js';
import { getUpdatedValue } from '@/utils/update.js';
import { createDeleteResponse } from '@/utils/delete.js';
import { snakeToCamel } from '@/utils/strings.js';
import { File, FilePurpose } from '@/files/entities/file.entity.js';
import { APIError, APIErrorCode } from '@/errors/error.entity.js';
import { Tool, ToolType } from '@/tools/entities/tool/tool.entity.js';
import { SystemTools } from '@/tools/entities/tool-calls/system-call.entity.js';

export function toMessageDto(message: Loaded<Message>): MessageDto {
  return {
    id: message.id,
    object: 'thread.message',
    role: message.role,
    content: [{ type: 'text', text: { value: message.content } }],
    run_id: message.run?.id,
    metadata: message.metadata ?? {},
    created_at: dayjs(message.createdAt).unix(),
    attachments: message.attachments?.map(toAttachmentDto) ?? null
  };
}

function toAttachmentDto(attachment: Attachment) {
  return {
    file_id: attachment.file.id,
    tools: (attachment.tools ?? []).map(toToolDto)
  };
}

function toToolDto(tool: { type: (typeof attachmentTypes)[number]; id?: string }) {
  switch (tool.type) {
    case ToolType.CODE_INTERPRETER:
    case ToolType.FILE_SEARCH:
      return { type: tool.type };
    case ToolType.USER:
    case ToolType.SYSTEM:
      if (!tool.id) throw new Error('Tool id not found');
      return { type: tool.type, id: tool.id };
  }
}

export async function createMessage(
  body: MessageCreateParams & MessageCreateBody
): Promise<MessageCreateResponse> {
  const message = await createMessageEntity(body);
  await ORM.em.flush();
  return toMessageDto(message);
}

export async function createMessageEntity({
  thread_id,
  role,
  content,
  metadata,
  attachments,
  order
}: MessageCreateParams & MessageCreateBody & { order?: number }): Promise<Message> {
  const thread = await ORM.em.getRepository(Thread).findOneOrFail({ id: thread_id });

  const attachmentFiles = attachments
    ? await ORM.em.getRepository(File).find({
        id: { $in: attachments.map((attachment) => attachment.file_id) },
        purpose: { $in: [FilePurpose.ASSISTANTS, FilePurpose.ASSISTANTS_OUTPUT] }
      })
    : [];

  const attachmentToolIds = attachments
    ? attachments
        .flatMap(
          (attachment) =>
            attachment.tools?.flatMap((t) =>
              t.type === 'user' || t.type === 'system' ? t.id : []
            ) ?? []
        )
        .filter((id) => !Object.keys(SystemTools).includes(id.toUpperCase()))
    : [];
  const toolsForAttachments = await ORM.em.getRepository(Tool).find({
    id: {
      $in: attachmentToolIds
    }
  });

  if (toolsForAttachments.length !== unique(attachmentToolIds).length) {
    throw new APIError({
      message: 'Some tool not found',
      code: APIErrorCode.NOT_FOUND
    });
  }

  const _attachments = attachments
    ? attachments
        .map((attachment) => {
          const file = attachmentFiles.find(
            (attachmentFile) => attachmentFile.id === attachment.file_id
          );
          if (!file)
            throw new APIError({
              message: 'File not found',
              code: APIErrorCode.NOT_FOUND
            });
          return new Attachment({
            file: ref(file),
            tools: attachment.tools?.map((tool) => ({
              type: tool.type,
              id: tool.type === 'system' || tool.type === 'user' ? tool.id : undefined
            }))
          });
        })
        .filter(isNonNullish)
    : undefined;

  const message = new Message({
    thread: ref(thread),
    role,
    content,
    metadata,
    attachments: _attachments,
    order
  });
  ORM.em.persist(message);
  return message;
}

export async function readMessage({
  thread_id,
  message_id
}: MessageReadParams): Promise<MessageReadResponse> {
  const message = await ORM.em.getRepository(Message).findOneOrFail({
    id: message_id,
    thread: thread_id
  });
  return toMessageDto(message);
}

export async function updateMessage({
  thread_id,
  message_id,
  metadata
}: MessageUpdateParams & MessageUpdateBody): Promise<MessageUpdateResponse> {
  const message = await ORM.em.getRepository(Message).findOneOrFail({
    id: message_id,
    thread: thread_id
  });
  message.metadata = getUpdatedValue(metadata, message.metadata);
  await ORM.em.flush();
  return toMessageDto(message);
}

export async function listMessages({
  thread_id,
  limit,
  after,
  before,
  order,
  order_by
}: MessagesListParams & MessagesListQuery): Promise<MessagesListResponse> {
  const repo = ORM.em.getRepository(Message);
  const aftr = after ? await repo.findOneOrFail({ id: after }) : undefined;
  const bfr = before ? await repo.findOneOrFail({ id: before }) : undefined;
  const cursor = await repo.findByCursor(
    {
      thread: thread_id,
      role: { $ne: 'tool_call' }
    },
    {
      first: limit,
      before: bfr && {
        [snakeToCamel(order_by)]: bfr[snakeToCamel(order_by) as keyof Message],
        id: bfr.id
      },
      after: aftr && {
        [snakeToCamel(order_by)]: aftr[snakeToCamel(order_by) as keyof Message],
        id: aftr.id
      },
      orderBy: [{ [snakeToCamel(order_by)]: order }, { order }, { id: order }]
    }
  );
  return createPaginatedResponse(cursor, toMessageDto);
}

export async function deleteMessage({
  thread_id,
  message_id
}: MessageDeleteParams): Promise<MessageDeleteResponse> {
  const message = await ORM.em
    .getRepository(Message)
    .findOneOrFail({ id: message_id, thread: thread_id });

  message.delete();
  await ORM.em.flush();

  return createDeleteResponse(message_id, 'thread.message');
}
