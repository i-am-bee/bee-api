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

import { ArtifactType } from '../entities/artifact.entity';

import { metadataSchema } from '@/schema.js';

const artifactSharedCommonProperties = {
  id: { type: 'string' },
  object: { const: 'artifact.shared' },
  metadata: metadataSchema,
  created_at: { type: 'number' },
  name: { type: 'string' },
  description: { type: 'string', nullable: true }
} as const;

export const artifactSharedSchema = {
  type: 'object',
  oneOf: [
    {
      required: ['id', 'type', 'created_at', 'object', 'metadata', 'name', 'description'],
      properties: {
        ...artifactSharedCommonProperties,
        type: {
          const: ArtifactType.APP
        },
        source_code: {
          type: 'string'
        }
      }
    }
  ]
} as const satisfies JSONSchema;
export type ArtifactShared = FromSchema<typeof artifactSharedSchema>;
