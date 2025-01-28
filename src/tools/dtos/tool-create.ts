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

import { toolSchema } from './tool.js';

import { metadataSchema } from '@/schema.js';

export const toolCreateBodySchema = {
  type: 'object',
  oneOf: [
    {
      additionalProperties: false,
      required: ['source_code'],
      properties: {
        name: { type: 'string' },
        source_code: { type: 'string' },
        metadata: metadataSchema,
        user_description: { type: 'string' }
      }
    },
    {
      additionalProperties: false,
      required: ['open_api_schema'],
      properties: {
        name: { type: 'string' },
        open_api_schema: { type: 'string' },
        api_key: { type: 'string', writeOnly: true },
        metadata: metadataSchema,
        user_description: { type: 'string' }
      }
    },
    {
      additionalProperties: false,
      required: ['name'],
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        parameters: { type: 'object', additionalProperties: true },
        metadata: metadataSchema,
        user_description: { type: 'string' }
      }
    }
  ]
} as const satisfies JSONSchema;
export type ToolCreateBody = FromSchema<typeof toolCreateBodySchema>;

export const toolCreateResponseSchema = toolSchema;
export type ToolCreateResponse = FromSchema<typeof toolCreateResponseSchema>;
