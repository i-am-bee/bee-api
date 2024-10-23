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
  ApiKeyCreateBody,
  apiKeyCreateBodySchema,
  ApiKeyCreateParams,
  apiKeyCreateParamsSchema,
  apiKeyCreateResponseSchema
} from './dtos/api-key-create';
import {
  ApiKeyReadParams,
  apiKeyReadParamsSchema,
  apiKeyReadResponseSchema
} from './dtos/api-key-read';
import {
  ApiKeyUpdateBody,
  apiKeyUpdateBodySchema,
  ApiKeyUpdateParams,
  apiKeyUpdateParamsSchema,
  apiKeyUpdateResponseSchema
} from './dtos/api-key-update';
import {
  apiKeysListParamsSchema,
  ApiKeysListParams,
  ApiKeysListQuery,
  apiKeysListQuerySchema,
  apiKeysListResponseSchema
} from './dtos/api-keys-list';
import {
  ApiKeyDeleteParams,
  apiKeyDeleteParamsSchema,
  apiKeyDeleteResponseSchema
} from './dtos/api-key-delete';
import {
  createApiKey,
  deleteApiKey,
  listApiKeys,
  readApiKey,
  updateApiKey
} from './api-keys.service';

import { AuthSecret } from '@/auth/utils';
import { Tag } from '@/swagger.js';

export const apiKeysModule: FastifyPluginAsyncJsonSchemaToTs = async (app) => {
  app.post<{ Body: ApiKeyCreateBody; Params: ApiKeyCreateParams }>(
    '/organization/projects/:project_id/api_keys',
    {
      schema: {
        body: apiKeyCreateBodySchema,
        params: apiKeyCreateParamsSchema,
        response: { [StatusCodes.OK]: apiKeyCreateResponseSchema },
        tags: [Tag.BEE_API]
      },
      preHandler: app.auth([AuthSecret.ACCESS_TOKEN])
    },
    async (req) => createApiKey({ ...req.body, ...req.params })
  );

  app.get<{ Params: ApiKeyReadParams }>(
    '/organization/projects/:project_id/api_keys/:api_key_id',
    {
      schema: {
        params: apiKeyReadParamsSchema,
        response: { [StatusCodes.OK]: apiKeyReadResponseSchema },
        tags: [Tag.BEE_API]
      },
      preHandler: app.auth([AuthSecret.ACCESS_TOKEN])
    },
    async (req) => readApiKey(req.params)
  );

  app.post<{ Params: ApiKeyUpdateParams; Body: ApiKeyUpdateBody }>(
    '/organization/projects/:project_id/api_keys/:api_key_id',
    {
      schema: {
        params: apiKeyUpdateParamsSchema,
        body: apiKeyUpdateBodySchema,
        response: { [StatusCodes.OK]: apiKeyUpdateResponseSchema },
        tags: [Tag.BEE_API]
      },
      preHandler: app.auth([AuthSecret.ACCESS_TOKEN])
    },
    async (req) => updateApiKey({ ...req.params, ...req.body })
  );

  app.get<{ Querystring: ApiKeysListQuery; Params: ApiKeysListParams }>(
    '/organization/projects/:project_id/api_keys',
    {
      schema: {
        querystring: apiKeysListQuerySchema,
        params: apiKeysListParamsSchema,
        response: { [StatusCodes.OK]: apiKeysListResponseSchema },
        tags: [Tag.BEE_API]
      },
      preHandler: app.auth([AuthSecret.ACCESS_TOKEN])
    },
    async (req) => listApiKeys({ ...req.params, ...req.query })
  );

  app.delete<{ Params: ApiKeyDeleteParams }>(
    '/organization/projects/:project_id/api_keys/:api_key_id',
    {
      schema: {
        params: apiKeyDeleteParamsSchema,
        response: { [StatusCodes.OK]: apiKeyDeleteResponseSchema },
        tags: [Tag.BEE_API]
      },
      preHandler: app.auth([AuthSecret.ACCESS_TOKEN])
    },
    async (req) => deleteApiKey(req.params)
  );
};
