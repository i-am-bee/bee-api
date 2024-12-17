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

import { assistantSchema } from './assistant.js';

import { toolUsageSchema } from '@/tools/dtos/tools-usage.js';
import { metadataSchema } from '@/schema.js';
import { toolResourcesSchema } from '@/tools/dtos/tool-resources.js';
import { Agent } from '@/runs/execution/constants.js';

export const assistantCreateBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    tools: {
      type: 'array',
      uniqueItems: true,
      default: [],
      items: toolUsageSchema
    },
    tool_resources: toolResourcesSchema,
    name: {
      type: 'string',
      nullable: true,
      maxLength: 256
    },
    description: {
      type: 'string',
      nullable: true,
      maxLength: 512
    },
    instructions: {
      type: 'string',
      nullable: true
    },
    system_prompt_overwrite: {
      type: 'string',
      nullable: true
    },
    metadata: metadataSchema,
    model: {
      type: 'string'
    },
    agent: {
      type: 'string',
      enum: Object.values(Agent),
      default: Agent.BEE
    },
    top_p: {
      type: 'number',
      nullable: true,
      maximum: 1,
      minimum: 0,
      multipleOf: 0.01
    },
    temperature: {
      type: 'number',
      nullable: true,
      maximum: 2,
      minimum: 0,
      multipleOf: 0.01
    }
  }
} as const satisfies JSONSchema;
export type AssistantCreateBody = FromSchema<typeof assistantCreateBodySchema>;

export const assistantCreateResponseSchema = assistantSchema;
export type AssistantCreateResponse = FromSchema<typeof assistantCreateResponseSchema>;
