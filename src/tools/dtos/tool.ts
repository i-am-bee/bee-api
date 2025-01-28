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

import { ToolType } from '../entities/tool/tool.entity.js';

import { metadataSchema } from '@/schema.js';

export const toolSchema = {
  type: 'object',
  required: [
    'id',
    'type',
    'object',
    'name',
    'is_external',
    'source_code',
    'created_at',
    'description',
    'json_schema',
    'open_api_schema',
    'user_description',
    'metadata'
  ],
  properties: {
    id: {
      type: 'string'
    },
    type: { type: 'string', enum: Object.values(ToolType) },
    object: { const: 'tool' },
    name: {
      type: 'string'
    },
    description: {
      type: 'string'
    },
    is_external: {
      type: 'boolean'
    },
    source_code: {
      type: 'string',
      nullable: true
    },
    json_schema: {
      type: 'string',
      nullable: true
    },
    open_api_schema: {
      type: 'string',
      nullable: true
    },
    api_key: {
      type: 'string',
      nullable: true
    },
    created_at: {
      type: 'number'
    },
    user_description: {
      type: 'string',
      nullable: true
    },
    metadata: metadataSchema
  }
} as const satisfies JSONSchema;
export type Tool = FromSchema<typeof toolSchema>;
