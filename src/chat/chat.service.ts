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
import dayjs from 'dayjs';

import {
  ChatCompletionCreateBody,
  ChatCompletionCreateResponse
} from './dtos/chat-completion-create';
import { ChatMessageRole } from './constants';

import { createChatLLM } from '@/runs/execution/factory';
import { getLogger } from '@/logger';
import { APIError, APIErrorCode } from '@/errors/error.entity';
import { generatePrefixedObjectId } from '@/utils/id';
import { getDefaultModel } from '@/runs/execution/constants';

const getChatLogger = () => getLogger();

export async function createChatCompletion({
  model = getDefaultModel(),
  messages,
  response_format
}: ChatCompletionCreateBody): Promise<ChatCompletionCreateResponse> {
  const llm = createChatLLM({ model });
  try {
    const schema = response_format?.json_schema.schema;
    const output = await llm.generate(
      messages.map(({ role, content }) => BaseMessage.of({ role, text: content })),
      {
        ...(schema
          ? {
              guided: {
                json: schema // We can't just set schema to undefined due to bug in the vLLM
              }
            }
          : {})
      }
    );
    return {
      id: generatePrefixedObjectId('chatcmpl'),
      object: 'chat.completion',
      created: dayjs().unix(),
      model,
      choices: output.messages.map((message, index) => {
        if (message.role !== ChatMessageRole.ASSISTANT)
          throw new LLMError(`Unexpected message role ${message.role}`);
        return {
          index,
          message: { role: message.role, content: message.text }
        };
      })
    };
  } catch (err) {
    getChatLogger().error({ err }, 'LLM generation failed');
    if (err instanceof LLMError) {
      throw new APIError({ code: APIErrorCode.SERVICE_ERROR, message: err.message });
    }
    throw err;
  }
}
