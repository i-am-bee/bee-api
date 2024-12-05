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

import { lastAssistants, modulesToPackages } from './ui.service.js';
import { lastAssistantsSchema } from './dtos/last_assistant.dto.js';
import {
  ModulesToPackagesQuery,
  modulesToPackagesQuerySchema,
  modulesToPackagesResponseSchema
} from './dtos/modules-to-packages.js';

import { Tag } from '@/swagger.js';
import { AuthSecret } from '@/auth/utils.js';

export const uiModule: FastifyPluginAsyncJsonSchemaToTs = async (app) => {
  app.get(
    '/ui/last_assistants',
    {
      schema: {
        response: { [StatusCodes.OK]: lastAssistantsSchema },
        tags: [Tag.BEE_API]
      },
      preHandler: app.auth()
    },
    async () => {
      return lastAssistants();
    }
  );

  app.get<{ Querystring: ModulesToPackagesQuery }>(
    '/ui/modules_to_packages',
    {
      schema: {
        querystring: modulesToPackagesQuerySchema,
        response: { [StatusCodes.OK]: modulesToPackagesResponseSchema },
        tags: [Tag.BEE_API]
      },
      preHandler: app.auth([
        AuthSecret.ACCESS_TOKEN,
        AuthSecret.API_KEY,
        AuthSecret.ARTIFACT_SECRET
      ])
    },
    async (req) => {
      return modulesToPackages(req.query);
    }
  );
};
