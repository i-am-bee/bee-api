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

import { metadataSchema } from '@/schema.js';

export const userSchema = {
  type: 'object',
  required: ['id', 'object', 'name', 'email', 'default_organization', 'default_project'],
  properties: {
    id: { type: 'string' },
    object: { const: 'user' },
    name: { type: 'string', nullable: true },
    email: { type: 'string', nullable: true },
    default_organization: { type: 'string', nullable: false },
    default_project: { type: 'string', nullable: false },
    metadata: metadataSchema
  }
} as const satisfies JSONSchema;
export type User = FromSchema<typeof userSchema>;
