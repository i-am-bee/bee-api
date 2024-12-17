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
  ArtifactCreateBody,
  artifactCreateBodySchema,
  artifactCreateResponseSchema
} from './dtos/artifact-create';
import {
  ArtifactReadParams,
  artifactReadParamsSchema,
  artifactReadResponseSchema
} from './dtos/artifact-read';
import {
  ArtifactUpdateBody,
  artifactUpdateBodySchema,
  ArtifactUpdateParams,
  artifactUpdateParamsSchema,
  artifactUpdateResponseSchema
} from './dtos/artifact-update';
import {
  ArtifactsListQuery,
  artifactsListQuerySchema,
  artifactsListResponseSchema
} from './dtos/artifacts-list';
import { ArtifactDeleteParams, artifactDeleteParamsSchema } from './dtos/artifact-delete';
import {
  ArtifactSharedReadParams,
  artifactSharedReadParamsSchema,
  ArtifactSharedReadQuery,
  artifactSharedReadQuerySchema,
  artifactSharedReadResponseSchema
} from './dtos/artifact-shared-read';
import {
  createArtifact,
  deleteArtifact,
  listArtifacts,
  readArtifact,
  readSharedArtifact,
  updateArtifact
} from './artifacts.service';

import { createDeleteSchema } from '@/schema.js';
import { Tag } from '@/swagger.js';

export const artifactsModule: FastifyPluginAsyncJsonSchemaToTs = async (app) => {
  app.post<{ Body: ArtifactCreateBody }>(
    '/artifacts',
    {
      schema: {
        body: artifactCreateBodySchema,
        response: { [StatusCodes.OK]: artifactCreateResponseSchema },
        tags: [Tag.BEE_API]
      },
      preHandler: app.auth()
    },
    async (req) => {
      return createArtifact(req.body);
    }
  );

  app.get<{ Params: ArtifactReadParams }>(
    '/artifacts/:artifact_id',
    {
      schema: {
        params: artifactReadParamsSchema,
        response: { [StatusCodes.OK]: artifactReadResponseSchema },
        tags: [Tag.BEE_API]
      },
      preHandler: app.auth()
    },
    async (req) => {
      return readArtifact(req.params);
    }
  );

  app.get<{ Params: ArtifactSharedReadParams; Querystring: ArtifactSharedReadQuery }>(
    '/artifacts/:artifact_id/shared',
    {
      schema: {
        params: artifactSharedReadParamsSchema,
        querystring: artifactSharedReadQuerySchema,
        response: { [StatusCodes.OK]: artifactSharedReadResponseSchema },
        tags: [Tag.BEE_API]
      }
    },
    async (req) => {
      return readSharedArtifact({ ...req.params, ...req.query });
    }
  );

  app.post<{ Params: ArtifactUpdateParams; Body: ArtifactUpdateBody }>(
    '/artifacts/:artifact_id',
    {
      schema: {
        params: artifactUpdateParamsSchema,
        body: artifactUpdateBodySchema,
        response: { [StatusCodes.OK]: artifactUpdateResponseSchema },
        tags: [Tag.BEE_API]
      },
      preHandler: app.auth()
    },
    async (req) => {
      return updateArtifact({ ...req.params, ...req.body });
    }
  );

  app.get<{ Querystring: ArtifactsListQuery }>(
    '/artifacts',
    {
      schema: {
        querystring: artifactsListQuerySchema,
        response: { [StatusCodes.OK]: artifactsListResponseSchema },
        tags: [Tag.BEE_API]
      },
      preHandler: app.auth()
    },
    async (req) => {
      return listArtifacts(req.query);
    }
  );

  app.delete<{ Params: ArtifactDeleteParams }>(
    '/artifacts/:artifact_id',
    {
      preHandler: app.auth(),
      schema: {
        params: artifactDeleteParamsSchema,
        response: {
          [StatusCodes.OK]: createDeleteSchema('artifact')
        },
        tags: [Tag.BEE_API]
      }
    },
    async (req) => deleteArtifact(req.params)
  );
};
