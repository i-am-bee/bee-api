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
import { FastifyRequest } from 'fastify';

import {
  ChatCompletionCreateBody,
  chatCompletionCreateBodySchema,
  chatCompletionCreateResponseSchema
} from './dtos/chat-completion-create.js';
import { createChatCompletion } from './chat.service.js';

import { Tag } from '@/swagger.js';
import { AuthSecret, determineAuthType } from '@/auth/utils.js';
import { ARTIFACT_SECRET_RATE_LIMIT } from '@/config.js';

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
          [StatusCodes.OK]: chatCompletionCreateResponseSchema
        },
        tags: [Tag.OPENAI_API]
      },
      config: {
        rateLimit: {
          max: (request: FastifyRequest) => {
            const authType = determineAuthType(request);
            if (authType.type === AuthSecret.ARTIFACT_SECRET) return ARTIFACT_SECRET_RATE_LIMIT;
            return 1;
          }
        }
      }
    },
    async (req) => createChatCompletion(req.body)
  );
};
