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

import { ProjectRole } from '../entities/constants';

import { projectUsersReadParamsSchema } from './project-users-read';
import { projectUserSchema } from './project-user';

export const projectUserUpdateBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    role: { type: 'string', enum: Object.values(ProjectRole) }
  }
} as const satisfies JSONSchema;
export type ProjectUserUpdateBody = FromSchema<typeof projectUserUpdateBodySchema>;

export const projectUserUpdateResponseSchema = projectUserSchema;
export type ProjectUserUpdateResponse = FromSchema<typeof projectUserUpdateResponseSchema>;

export const projectUserUpdateParamsSchema = projectUsersReadParamsSchema;
export type ProjectUserUpdateParams = FromSchema<typeof projectUserUpdateParamsSchema>;