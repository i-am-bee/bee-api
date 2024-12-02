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

import { FromSchema, JSONSchema } from 'json-schema-to-ts';

import { ChatMessageRole } from '../constants';

import { chatCompletionSchema } from './chat-completion';

export const chatCompletionCreateBodySchema = {
  type: 'object',
  required: ['messages'],
  properties: {
    model: { type: 'string' },
    messages: {
      type: 'array',
      minItems: 1,
      items: {
        oneOf: [
          {
            type: 'object',
            required: ['role', 'content'],
            properties: { role: { const: ChatMessageRole.SYSTEM }, content: { type: 'string' } }
          },
          {
            type: 'object',
            required: ['role', 'content'],
            properties: { role: { const: ChatMessageRole.USER }, content: { type: 'string' } }
          },
          {
            type: 'object',
            required: ['role', 'content'],
            properties: { role: { const: ChatMessageRole.ASSISTANT }, content: { type: 'string' } }
          }
        ]
      }
    },
    response_format: {
      type: 'object',
      required: ['type', 'json_schema'],
      properties: {
        type: { const: 'json_schema' },
        json_schema: {
          type: 'object',
          required: ['schema'],
          properties: {
            schema: { type: 'object', additionalProperties: true }
          }
        }
      }
    }
  }
} as const satisfies JSONSchema;
export type ChatCompletionCreateBody = FromSchema<typeof chatCompletionCreateBodySchema>;

export const chatCompletionCreateResponseSchema = chatCompletionSchema;
export type ChatCompletionCreateResponse = FromSchema<typeof chatCompletionCreateResponseSchema>;
