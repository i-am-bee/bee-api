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

import { runParamsSchema, runSchema } from './run.js';

import { eventSchema } from '@/streaming/dtos/event.js';

export const runSubmitToolInputsParamsSchema = runParamsSchema;
export type RunSubmitToolInputsParams = FromSchema<typeof runSubmitToolInputsParamsSchema>;

export const runSubmitToolInputsBodySchema = {
  type: 'object',
  required: ['tool_inputs'],
  additionalProperties: false,
  properties: {
    tool_inputs: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['tool_call_id', 'inputs'],
        properties: {
          tool_call_id: { type: 'string' },
          inputs: {
            type: 'array',
            items: {
              type: 'object',
              required: ['name', 'value'],
              additionalProperties: false,
              properties: {
                name: { type: 'string' },
                value: { type: 'string' }
              }
            }
          }
        }
      }
    },
    stream: {
      type: 'boolean',
      nullable: true
    }
  }
} as const satisfies JSONSchema;
export type RunSubmitToolInputsBody = FromSchema<typeof runSubmitToolInputsBodySchema>;

export const runSubmitToolInputsResponseSchema = runSchema;
export type RunSubmitToolInputsResponse = FromSchema<typeof runSubmitToolInputsResponseSchema>;

export const runSubmitToolInputsStreamSchema = eventSchema;
export type RunSubmitToolInputsStream = FromSchema<typeof runSubmitToolInputsStreamSchema>;
