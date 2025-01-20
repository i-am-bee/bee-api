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

import { JSONSchema } from 'json-schema-to-ts';

export const metadataSchema = {
  type: 'object',
  maxProperties: 16,
  propertyNames: {
    pattern: '^.{1,64}$'
  },
  patternProperties: {
    '.*': { type: 'string', maxLength: 512 }
  },
  additionalProperties: true,
  nullable: true
} as const satisfies JSONSchema;

export const createPaginationQuerySchema = <T extends readonly string[]>(
  additionalOrderByColumns: T | never[] = []
) =>
  ({
    type: 'object',
    additionalProperties: false,
    properties: {
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 100,
        default: 20
      },
      after: { type: 'string' },
      before: { type: 'string' },
      order: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
      order_by: {
        type: 'string',
        default: 'created_at',
        enum: ['created_at', ...additionalOrderByColumns]
      }
    }
  }) as const satisfies JSONSchema;

export function withPagination<T extends JSONSchema>(schema: T) {
  return {
    type: 'object',
    required: ['data', 'first_id', 'last_id', 'has_more', 'total_count'],
    properties: {
      data: { type: 'array', items: schema },
      first_id: { type: 'string', nullable: true },
      last_id: { type: 'string', nullable: true },
      has_more: { type: 'boolean' },
      total_count: { type: 'number', nullable: false }
    }
  } as const satisfies JSONSchema;
}

export const noContentSchema = { type: 'null' } as const satisfies JSONSchema;

export const createDeleteSchema = <T extends string>(object: T) =>
  ({
    type: 'object',
    required: ['id', 'object', 'deleted'],
    properties: {
      id: { type: 'string' },
      object: { const: `${object}.deleted` },
      deleted: { type: 'boolean', default: true }
    }
  }) as const satisfies JSONSchema;
