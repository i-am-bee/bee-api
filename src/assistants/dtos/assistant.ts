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

import { toolUsageSchema } from '@/tools/dtos/tools-usage.js';
import { metadataSchema } from '@/schema.js';
import { toolResourcesSchema } from '@/tools/dtos/tool-resources.js';
import { Agent } from '@/runs/execution/constants';

export const assistantSchema = {
  type: 'object',
  required: [
    'id',
    'object',
    'tools',
    'instructions',
    'name',
    'description',
    'metadata',
    'created_at',
    'model',
    'agent'
  ],
  properties: {
    id: { type: 'string' },
    object: { const: 'assistant' },
    tools: {
      type: 'array',
      items: toolUsageSchema
    },
    tool_resources: toolResourcesSchema,
    instructions: {
      type: 'string',
      nullable: true
    },
    system_prompt_overwrite: {
      type: 'string',
      nullable: true
    },
    name: {
      type: 'string',
      nullable: true
    },
    description: {
      type: 'string',
      nullable: true
    },
    metadata: metadataSchema,
    created_at: { type: 'number' },
    model: {
      type: 'string'
    },
    agent: {
      type: 'string',
      enum: Object.values(Agent)
    },
    top_p: {
      type: 'number',
      nullable: true
    },
    temperature: {
      type: 'number',
      nullable: true
    }
  }
} as const satisfies JSONSchema;
export type Assistant = FromSchema<typeof assistantSchema>;
