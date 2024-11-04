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

import { PrincipalType } from '../entities/principals/principal.entity';

import { projectSchema } from './project';
import { projectUserSchema } from './project-user';

export const apiKeySchema = {
  type: 'object',
  required: ['object', 'id', 'name', 'created_at', 'secret', 'project', 'last_used_at', 'owner'],
  properties: {
    object: { const: 'organization.project.api_key' },
    id: { type: 'string' },
    name: { type: 'string' },
    created_at: { type: 'number' },
    last_used_at: { type: 'number', nullable: true },
    secret: { type: 'string' },
    project: projectSchema,
    owner: {
      required: ['type'],
      properties: {
        type: { type: 'string', enum: Object.values(PrincipalType) },
        [PrincipalType.USER]: projectUserSchema,
        [PrincipalType.SERVICE_ACCOUNT]: {} // TODO service account
      }
    }
  }
} as const satisfies JSONSchema;
export type ApiKey = FromSchema<typeof apiKeySchema>;
