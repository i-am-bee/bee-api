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

import { embeddingsSchema } from './embeddings';

export const embeddingsCreateBodySchema = {
  type: 'object',
  required: ['input'],
  properties: {
    model: { type: 'string' },
    input: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] }
  }
} as const satisfies JSONSchema;
export type EmbeddingsCreateBody = FromSchema<typeof embeddingsCreateBodySchema>;

export const embeddingsCreateResponseSchema = {
  type: 'object',
  required: ['object', 'data'],
  properties: {
    object: { const: 'list' },
    data: { type: 'array', items: embeddingsSchema }
  }
} as const satisfies JSONSchema;
export type EmbeddingsCreateResponse = FromSchema<typeof embeddingsCreateResponseSchema>;
