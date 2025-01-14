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

import { toolSchema } from './tool';

export const toolSecretSchema = {
  type: 'object',
  required: ['id', 'object', 'name', 'value', 'tool'],
  properties: {
    id: {
      type: 'string'
    },
    object: { const: 'tool-secret' },
    name: {
      type: 'string'
    },
    value: {
      type: 'string'
    },
    tool: toolSchema
  }
} as const satisfies JSONSchema;
export type ToolSecret = FromSchema<typeof toolSecretSchema>;
