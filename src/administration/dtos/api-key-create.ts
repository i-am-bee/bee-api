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

import { apiKeySchema } from './api-key.js';
import { apiKeysListParamsSchema } from './api-keys-list.js';

export const apiKeyCreateBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name'],
  properties: {
    name: { type: 'string' }
  }
} as const satisfies JSONSchema;
export type ApiKeyCreateBody = FromSchema<typeof apiKeyCreateBodySchema>;

export const apiKeyCreateParamsSchema = apiKeysListParamsSchema;
export type ApiKeyCreateParams = FromSchema<typeof apiKeyCreateParamsSchema>;

export const apiKeyCreateResponseSchema = apiKeySchema;
export type ApiKeyCreateResponse = FromSchema<typeof apiKeyCreateResponseSchema>;
