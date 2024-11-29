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

export const modulesToPackagesQuerySchema = {
  type: 'object',
  required: ['modules'],
  properties: {
    modules: {
      type: 'array',
      minItems: 1,
      items: { type: 'string' }
    }
  }
} as const satisfies JSONSchema;
export type ModulesToPackagesQuery = FromSchema<typeof modulesToPackagesQuerySchema>;

export const modulesToPackagesResponseSchema = {
  type: 'object',
  required: ['packages'],
  properties: {
    packages: {
      type: 'array',
      items: { type: 'string' }
    }
  }
} as const satisfies JSONSchema;
export type ModulesToPackagesResponse = FromSchema<typeof modulesToPackagesResponseSchema>;
