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

import { toolSecretReadParamsSchema } from './tool-secret-read';
import { toolSecretSchema } from './tool-secret';

export const toolSecretUpdateBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'value', 'tool_id'],
  properties: {
    name: { type: 'string' },
    value: { type: 'string' },
    tool_id: { type: 'string' }
  }
} as const satisfies JSONSchema;
export type ToolSecretUpdateBody = FromSchema<typeof toolSecretUpdateBodySchema>;

export const toolSecretUpdateParamsSchema = toolSecretReadParamsSchema;
export type ToolSecretUpdateParams = FromSchema<typeof toolSecretUpdateParamsSchema>;

export const toolSecretUpdateResponseSchema = toolSecretSchema;
export type ToolSecretUpdateResponse = FromSchema<typeof toolSecretUpdateResponseSchema>;
