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

import { apiKeyReadParamsSchema } from './api-key-read';
import { apiKeySchema } from './api-key';

export const apiKeyUpdateParamsSchema = apiKeyReadParamsSchema;
export type ApiKeyUpdateParams = FromSchema<typeof apiKeyUpdateParamsSchema>;

export const apiKeyUpdateBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' }
  }
} as const satisfies JSONSchema;
export type ApiKeyUpdateBody = FromSchema<typeof apiKeyUpdateBodySchema>;

export const apiKeyUpdateResponseSchema = apiKeySchema;
export type ApiKeyUpdateResponse = FromSchema<typeof apiKeyUpdateResponseSchema>;
