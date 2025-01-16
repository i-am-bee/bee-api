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

import { RunStatus } from '../entities/run.entity.js';

import { errorSchema } from '@/errors/dtos/error.js';
import { toolUsageSchema } from '@/tools/dtos/tools-usage.js';
import { metadataSchema } from '@/schema.js';
import { toolCallSchema } from '@/tools/dtos/tool-call.js';

export const runParamsSchema = {
  type: 'object',
  required: ['thread_id', 'run_id'],
  additionalProperties: false,
  properties: {
    thread_id: { type: 'string' },
    run_id: { type: 'string' }
  }
} as const satisfies JSONSchema;
export type RunParams = FromSchema<typeof runParamsSchema>;

export const runSchema = {
  type: 'object',
  required: [
    'id',
    'object',
    'thread_id',
    'assistant_id',
    'status',
    'last_error',
    'required_action',
    'tools',
    'instructions',
    'additional_instructions',
    'metadata',
    'created_at',
    'expires_at',
    'started_at',
    'completed_at',
    'failed_at',
    'cancelled_at',
    'model'
  ],
  properties: {
    id: { type: 'string' },
    object: { const: 'thread.run' },
    thread_id: { type: 'string' },
    assistant_id: { type: 'string' },
    status: { type: 'string', enum: Object.values(RunStatus) },
    last_error: {
      ...errorSchema,
      nullable: true
    },
    required_action: {
      type: 'object',
      oneOf: [
        {
          required: ['type', 'submit_tool_outputs'],
          properties: {
            type: { const: 'submit_tool_outputs' },
            submit_tool_outputs: {
              type: 'object',
              required: ['tool_calls'],
              properties: {
                tool_calls: {
                  type: 'array',
                  items: toolCallSchema
                }
              }
            }
          }
        },
        {
          required: ['type', 'submit_tool_inputs'],
          properties: {
            type: { const: 'submit_tool_inputs' },
            submit_tool_inputs: {
              type: 'object',
              required: ['tool_calls', 'input_fields'],
              properties: {
                tool_calls: {
                  type: 'array',
                  items: toolCallSchema
                },
                input_fields: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        },
        {
          required: ['type', 'submit_tool_approvals'],
          properties: {
            type: { const: 'submit_tool_approvals' },
            submit_tool_approvals: {
              type: 'object',
              required: ['tool_calls'],
              properties: {
                tool_calls: {
                  type: 'array',
                  items: toolCallSchema
                }
              }
            }
          }
        }
      ],
      nullable: true
    },
    tools: {
      type: 'array',
      items: toolUsageSchema
    },
    instructions: {
      type: 'string',
      nullable: true
    },
    additional_instructions: {
      type: 'string',
      nullable: true
    },
    metadata: metadataSchema,
    model: {
      type: 'string'
    },
    top_p: {
      type: 'number',
      nullable: true
    },
    temperature: {
      type: 'number',
      nullable: true
    },
    created_at: { type: 'number', nullable: true },
    started_at: { type: 'number', nullable: true },
    expires_at: { type: 'number', nullable: true },
    failed_at: { type: 'number', nullable: true },
    cancelled_at: { type: 'number', nullable: true },
    completed_at: { type: 'number', nullable: true }
  }
} as const satisfies JSONSchema;
export type Run = FromSchema<typeof runSchema>;
