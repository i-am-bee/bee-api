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
import { omit } from 'remeda';

import { autoChunkingStrategySchema, staticChunkingStrategySchema } from './chunking-strategy.js';

import { VectorStoreFileStatus } from '@/vector-store-files/entities/vector-store-file.entity.js';
import { errorSchema } from '@/errors/dtos/error.js';

export const vectorStoreFileSchema = {
  type: 'object',
  title: 'Vector store files',
  description: 'A list of files attached to a vector store.',
  properties: {
    id: {
      description: 'The identifier, which can be referenced in API endpoints.',
      type: 'string'
    },
    object: {
      description: 'The object type, which is always `vector_store.file`.',
      type: 'string',
      enum: ['vector_store.file']
    },
    usage_bytes: {
      description:
        'The total vector store usage in bytes. Note that this may be different from the original file size.',
      type: 'integer'
    },
    created_at: {
      description: 'The Unix timestamp (in seconds) for when the vector store file was created.',
      type: 'integer'
    },
    vector_store_id: {
      description: 'The ID of the vector store that the file is attached to.',
      type: 'string'
    },
    status: {
      description:
        'The status of the vector store file, which can be either `in_progress`, `completed`, `cancelled`, or `failed`. The status `completed` indicates that the vector store file is ready for use.',
      type: 'string',
      enum: Object.values(omit(VectorStoreFileStatus, ['CANCELLING']))
    },
    last_error: { ...errorSchema, nullable: true },
    chunking_strategy: {
      type: 'object',
      description: 'The strategy used to chunk the file.',
      oneOf: [autoChunkingStrategySchema, staticChunkingStrategySchema]
    }
  },
  required: ['id', 'object', 'usage_bytes', 'created_at', 'vector_store_id', 'status', 'last_error']
} as const satisfies JSONSchema;

export type VectorStoreFile = FromSchema<typeof vectorStoreFileSchema>;
