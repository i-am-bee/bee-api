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

import { apiKeySchema } from './api-key';

import { createPaginationQuerySchema, withPagination } from '@/schema.js';

export const apiKeysListQuerySchema = createPaginationQuerySchema();
export type ApiKeysListQuery = FromSchema<typeof apiKeysListQuerySchema>;

export const apiKeysListResponseSchema = withPagination(apiKeySchema);
export type ApiKeysListResponse = FromSchema<typeof apiKeysListResponseSchema>;

export const apiKeysListParamsSchema = {
  type: 'object',
  required: ['project_id'],
  additionalProperties: false,
  properties: {
    project_id: { type: 'string' }
  }
} as const satisfies JSONSchema;
export type ApiKeysListParams = FromSchema<typeof apiKeysListParamsSchema>;
