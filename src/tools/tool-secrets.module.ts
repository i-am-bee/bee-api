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
  ToolSecretCreateBody,
  toolSecretCreateBodySchema,
  toolSecretCreateResponseSchema
} from './dtos/tool-secret-create';
import {
  ToolSecretUpdateBody,
  toolSecretUpdateBodySchema,
  ToolSecretUpdateParams,
  toolSecretUpdateParamsSchema,
  toolSecretUpdateResponseSchema
} from './dtos/tool-secret-update';
import {
  ToolSecretsListQuery,
  toolSecretsListQuerySchema,
  toolSecretsListResponseSchema
} from './dtos/tool-secrets-list';
import {
  ToolSecretReadParams,
  toolSecretReadParamsSchema,
  toolSecretReadResponseSchema
} from './dtos/tool-secret-read';
import {
  ToolSecretDeleteParams,
  toolSecretDeleteParamsSchema,
  toolSecretDeleteResponseSchema
} from './dtos/tool-secret-delete';
import {
  createToolSecret,
  deleteToolSecret,
  listToolSecrets,
  readToolSecret,
  updateToolSecret
} from './tool-secrets.service';

import { Tag } from '@/swagger.js';

export const toolSecretsModule: FastifyPluginAsyncJsonSchemaToTs = async (app) => {
  app.post<{ Body: ToolSecretCreateBody }>(
    '/tool_secrets',
    {
      preHandler: app.auth(),
      schema: {
        body: toolSecretCreateBodySchema,
        response: {
          [StatusCodes.OK]: toolSecretCreateResponseSchema
        },
        tags: [Tag.BEE_API]
      }
    },
    async (req) => createToolSecret(req.body)
  );

  app.post<{ Body: ToolSecretUpdateBody; Params: ToolSecretUpdateParams }>(
    '/tool_secrets/:tool_secret_id',
    {
      preHandler: app.auth(),
      schema: {
        body: toolSecretUpdateBodySchema,
        params: toolSecretUpdateParamsSchema,
        response: {
          [StatusCodes.OK]: toolSecretUpdateResponseSchema
        },
        tags: [Tag.BEE_API]
      }
    },
    async (req) => updateToolSecret({ ...req.body, ...req.params })
  );

  app.get<{ Querystring: ToolSecretsListQuery }>(
    '/tool_secrets',
    {
      preHandler: app.auth(),
      schema: {
        querystring: toolSecretsListQuerySchema,
        response: {
          [StatusCodes.OK]: toolSecretsListResponseSchema
        },
        tags: [Tag.BEE_API]
      }
    },
    async (req) => listToolSecrets(req.query)
  );

  app.get<{ Params: ToolSecretReadParams }>(
    '/tool_secrets/:tool_secret_id',
    {
      preHandler: app.auth(),
      schema: {
        params: toolSecretReadParamsSchema,
        response: {
          [StatusCodes.OK]: toolSecretReadResponseSchema
        },
        tags: [Tag.BEE_API]
      }
    },
    async (req) => readToolSecret(req.params)
  );

  app.delete<{ Params: ToolSecretDeleteParams }>(
    '/tool_secrets/:tool_secret_id',
    {
      preHandler: app.auth(),
      schema: {
        params: toolSecretDeleteParamsSchema,
        response: {
          [StatusCodes.OK]: toolSecretDeleteResponseSchema
        },
        tags: [Tag.BEE_API]
      }
    },
    async (req) => deleteToolSecret(req.params)
  );
};
