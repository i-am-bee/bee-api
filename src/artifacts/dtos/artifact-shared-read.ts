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

import { FromSchema } from 'json-schema-to-ts';

import { artifactReadParamsSchema } from './artifact-read.js';
import { artifactSharedSchema } from './artifact-shared.js';

import { JSONSchema } from '@/ajv.js';

export const artifactSharedReadParamsSchema = artifactReadParamsSchema;
export type ArtifactSharedReadParams = FromSchema<typeof artifactSharedReadParamsSchema>;

export const artifactSharedReadResponseSchema = artifactSharedSchema;
export type ArtifactSharedReadResponse = FromSchema<typeof artifactSharedReadResponseSchema>;

export const artifactSharedReadQuerySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['secret'],
  properties: {
    secret: {
      type: 'string',
      nullable: false
    }
  }
} as const satisfies JSONSchema;
export type ArtifactSharedReadQuery = FromSchema<typeof artifactSharedReadQuerySchema>;
