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

import { ArtifactType } from '../entities/artifact.entity.js';

import { artifactSchema } from './artifact.js';

import { metadataSchema } from '@/schema.js';

const commonArtifactProperties = {
  message_id: { type: 'string' },
  metadata: metadataSchema,
  shared: { type: 'boolean' },
  name: { type: 'string' },
  description: { type: 'string' }
} as const;

export const artifactCreateBodySchema = {
  type: 'object',
  oneOf: [
    {
      required: ['type', 'source_code', 'name'],
      additionalProperties: false,
      properties: {
        ...commonArtifactProperties,
        type: {
          type: 'string',
          const: ArtifactType.APP
        },
        source_code: { type: 'string' }
      }
    }
  ]
} as const satisfies JSONSchema;
export type ArtifactCreateBody = FromSchema<typeof artifactCreateBodySchema>;

export const artifactCreateResponseSchema = artifactSchema;
export type ArtifactCreateResponse = FromSchema<typeof artifactCreateResponseSchema>;
