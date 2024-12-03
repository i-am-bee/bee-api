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

import { artifactSchema } from './artifact.js';
import { artifactReadParamsSchema } from './artifact-read.js';

import { metadataSchema } from '@/schema.js';

export const artifactUpdateParamsSchema = artifactReadParamsSchema;
export type ArtifactUpdateParams = FromSchema<typeof artifactUpdateParamsSchema>;

const commonArtifactUpdateProperties = {
  metadata: metadataSchema,
  shared: { type: 'boolean' },
  name: { type: 'string' },
  description: { type: 'string' },
  message_id: { type: 'string' }
} as const;

export const artifactUpdateBodySchema = {
  type: 'object',
  oneOf: [
    {
      additionalProperties: false,
      properties: {
        ...commonArtifactUpdateProperties,
        source_code: { type: 'string' }
      }
    }
  ]
} as const satisfies JSONSchema;
export type ArtifactUpdateBody = FromSchema<typeof artifactUpdateBodySchema>;

export const artifactUpdateResponseSchema = artifactSchema;
export type ArtifactUpdateResponse = FromSchema<typeof artifactUpdateResponseSchema>;
