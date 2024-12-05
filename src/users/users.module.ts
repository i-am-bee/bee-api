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
  UserCreateBody,
  userCreateBodySchema,
  userCreateResponseSchema
} from './dtos/user-create.js';
import { userReadResponseSchema } from './dtos/user-read.js';
import { createUser, readUser, updateUser } from './users.service.js';
import {
  UserUpdateBody,
  userUpdateBodySchema,
  userUpdateResponseSchema
} from './dtos/user-update.js';

import { getTrustedIdentity } from '@/auth/authentication.js';
import { Tag } from '@/swagger.js';
import { AuthSecret } from '@/auth/utils.js';

export const usersModule: FastifyPluginAsyncJsonSchemaToTs = async (app) => {
  app.post<{ Body: UserCreateBody }>(
    '/users',
    {
      schema: {
        body: userCreateBodySchema,
        response: { [StatusCodes.OK]: userCreateResponseSchema },
        tags: [Tag.BEE_API]
      }
    },
    async (req) => {
      const identity = await getTrustedIdentity(req);
      return createUser({
        ...req.body,
        externalId: identity.sub,
        email: identity.email,
        name: req.body.name
      });
    }
  );

  app.put<{ Body: UserUpdateBody }>(
    '/users',
    {
      schema: {
        body: userUpdateBodySchema,
        response: { [StatusCodes.OK]: userUpdateResponseSchema },
        tags: [Tag.BEE_API]
      },
      preHandler: app.auth([AuthSecret.ACCESS_TOKEN])
    },
    async (req) => {
      return updateUser(req.body);
    }
  );

  app.get(
    '/users',
    {
      schema: { response: { [StatusCodes.OK]: userReadResponseSchema }, tags: [Tag.BEE_API] },
      preHandler: app.auth()
    },
    async () => readUser({})
  );
};
