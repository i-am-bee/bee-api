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

import { FastifyPluginAsyncJsonSchemaToTs } from '@fastify/type-provider-json-schema-to-ts';
import { StatusCodes } from 'http-status-codes';

import {
  ChatCompletionCreateBody,
  chatCompletionCreateBodySchema,
  chatCompletionCreateResponseSchema,
  chatCompletionCreateResponseStreamSchema
} from './dtos/chat-completion-create.js';
import { createChatCompletion } from './chat.service.js';

import { Tag } from '@/swagger.js';
import { AuthSecret } from '@/auth/utils.js';

export const chatModule: FastifyPluginAsyncJsonSchemaToTs = async (app) => {
  app.post<{ Body: ChatCompletionCreateBody }>(
    '/chat/completions',
    {
      preHandler: app.auth([
        AuthSecret.ACCESS_TOKEN,
        AuthSecret.API_KEY,
        AuthSecret.ARTIFACT_SECRET
      ]),
      schema: {
        body: chatCompletionCreateBodySchema,
        response: {
          [StatusCodes.OK]: {
            content: {
              'application/json': { schema: chatCompletionCreateResponseSchema },
              'text/event-stream': { schema: chatCompletionCreateResponseStreamSchema }
            }
          }
        },
        tags: [Tag.OPENAI_API]
      }
    },
    async (req) => createChatCompletion(req.body)
  );
};
