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

import { vectorStoreReadParamsSchema } from './vector-store-read.js';
import { vectorStoreSchema } from './vector-store.js';

import { vectorStoreExpirationAfterSchema } from '@/vector-stores/dtos/vector-store-expiration-after.js';
import { metadataSchema } from '@/schema.js';

export const vectorStoreUpdateBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { description: 'The name of the vector store.', type: 'string', nullable: true },
    expires_after: { ...vectorStoreExpirationAfterSchema, nullable: true },
    metadata: metadataSchema
  }
} as const satisfies JSONSchema;
export type VectorStoreUpdateBody = FromSchema<typeof vectorStoreUpdateBodySchema>;

export const vectorStoreUpdateParamsSchema = vectorStoreReadParamsSchema;
export type VectorStoreUpdateParams = FromSchema<typeof vectorStoreUpdateParamsSchema>;

export const vectorStoreUpdateResponseSchema = vectorStoreSchema;
export type VectorStoreUpdateResponse = FromSchema<typeof vectorStoreUpdateResponseSchema>;