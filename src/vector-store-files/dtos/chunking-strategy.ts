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

export const autoChunkingStrategySchema = {
  type: 'object',
  title: 'Auto Chunking Strategy',
  description: 'Automatic strategy, uses semantic-aware chunking.',
  additionalProperties: false,
  properties: { type: { type: 'string', description: 'Always `auto`.', enum: ['auto'] } },
  required: ['type']
} as const satisfies JSONSchema;

export const staticChunkingStrategySchema = {
  type: 'object',
  title: 'Static Chunking Strategy',
  additionalProperties: false,
  properties: {
    type: { type: 'string', description: 'Always `static`.', enum: ['static'] },
    static: {
      type: 'object',
      additionalProperties: false,
      properties: {
        max_chunk_size_tokens: {
          type: 'integer',
          minimum: 100,
          maximum: 512, // TODO: Too low, find a better embedding model
          description: 'The maximum number of tokens in each chunk.'
        },
        chunk_overlap_tokens: {
          type: 'integer',
          description: 'The number of tokens that overlap between chunks.'
        }
      },
      required: ['max_chunk_size_tokens', 'chunk_overlap_tokens']
    }
  },
  required: ['type', 'static']
} as const satisfies JSONSchema;

export const chunkingStrategyRequestParamSchema = {
  type: 'object',
  description:
    'The chunking strategy used to chunk the file(s). If not set, will use the `auto` strategy.',
  oneOf: [autoChunkingStrategySchema]
} as const satisfies JSONSchema;

export type ChunkingStrategyRequestParam = FromSchema<typeof chunkingStrategyRequestParamSchema>;
