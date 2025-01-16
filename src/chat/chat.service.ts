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

import { BaseMessage } from 'bee-agent-framework/llms/primitives/message';
import { LLMError } from 'bee-agent-framework/llms/base';
import { Loaded } from '@mikro-orm/core';
import dayjs from 'dayjs';

import {
  ChatCompletionCreateBody,
  ChatCompletionCreateResponse
} from './dtos/chat-completion-create';
import { ChatMessageRole } from './constants';
import { Chat } from './entities/chat.entity';
import { ChatCompletionChunk } from './dtos/chat-completion-chunk';

import { getServiceLogger } from '@/logger';
import { APIError, APIErrorCode } from '@/errors/error.entity';
import { ORM } from '@/database';
import { defaultAIProvider } from '@/runs/execution/provider';
import { ensureRequestContextData } from '@/context';
import { listenToSocketClose } from '@/utils/networking';
import * as sse from '@/streaming/sse';

const getChatLogger = () => getServiceLogger('chat');

export function toChatDto(chat: Loaded<Chat>): ChatCompletionCreateResponse {
  return {
    id: chat.id,
    object: 'chat.completion',
    created: dayjs(chat.createdAt).unix(),
    model: chat.model,
    choices: (chat.output?.messages || []).map((message, index) => {
      if (message.role !== ChatMessageRole.ASSISTANT)
        throw new LLMError(`Unexpected message role ${message.role}`);
      return {
        index,
        message: { role: message.role, content: message.text }
      };
    })
  };
}

export async function createChatCompletion({
  model,
  stream,
  messages,
  response_format
}: ChatCompletionCreateBody): Promise<ChatCompletionCreateResponse | void> {
  const llm = defaultAIProvider.createChatBackend({ model });
  const chat = new Chat({ model: llm.modelId, messages, responseFormat: response_format });
  await ORM.em.persistAndFlush(chat);

  const schema = response_format?.json_schema.schema;
  const args = [
    messages.map(({ role, content }) => BaseMessage.of({ role, text: content })),
    {
      ...(schema
        ? {
            guided: {
              json: schema // We can't just set schema to undefined due to bug in the vLLM
            }
          }
        : {}),
      stream: !!stream
    }
  ] as const;

  try {
    if (stream) {
      const req = ensureRequestContextData('req');
      const res = ensureRequestContextData('res');
      const controller = new AbortController();
      const unsub = listenToSocketClose(req.socket, () => controller.abort());
      sse.init(res);
      try {
        chat.output = await llm.generate(...args).observe((emitter) => {
          emitter.on('newToken', ({ value }) => {
            sse.send(res, {
              data: {
                id: chat.id,
                object: 'chat.completion.chunk',
                model: llm.modelId,
                created: dayjs(chat.createdAt).unix(),
                choices: value.messages.map((message, index) => {
                  if (message.role !== ChatMessageRole.ASSISTANT)
                    throw new LLMError(`Unexpected message role ${message.role}`);
                  return {
                    index,
                    delta: { role: message.role, content: message.text }
                  };
                })
              } as const satisfies ChatCompletionChunk
            });
          });
        });
      } catch (err) {
        sse.send(res, { data: chat.error ?? 'Internal server error' }); // TODO
        throw err;
      } finally {
        sse.end(res);
        unsub();
      }
    } else {
      chat.output = await llm.generate(...args);
      return toChatDto(chat);
    }
  } catch (err) {
    getChatLogger().error({ err }, 'LLM generation failed');
    chat.error = err.toString();
    if (err instanceof LLMError) {
      throw new APIError({ code: APIErrorCode.SERVICE_ERROR, message: err.message });
    } else {
      throw err;
    }
  } finally {
    await ORM.em.flush();
  }
}
