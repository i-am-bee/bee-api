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

import { artifactSharedSchema } from './artifact-shared';

const artifactCommonSchema = {
  type: 'object',
  properties: {
    object: { const: 'artifact' },
    thread_id: { type: 'string', nullable: true },
    message_id: { type: 'string', nullable: true },
    share_url: { type: 'string', nullable: true }
  },
  oneOf: artifactSharedSchema.oneOf
} as const satisfies JSONSchema;

export const artifactSchema = {
  ...artifactSharedSchema,
  // must be repeated for each value from oneOf
  oneOf: [
    {
      required: [...artifactSharedSchema.oneOf[0].required, 'thread_id', 'message_id', 'share_url'],
      properties: {
        ...artifactSharedSchema.oneOf[0].properties,
        ...artifactCommonSchema.properties
      }
    }
  ]
} as const satisfies JSONSchema;

export type Artifact = FromSchema<typeof artifactSchema>;
