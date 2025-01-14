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

import type {
  Cursor,
  EntityRepository,
  FilterQuery,
  FindByCursorOptions,
  Loaded
} from '@mikro-orm/core';
import { FromSchema } from 'json-schema-to-ts';

import { snakeToCamel } from './strings.js';

import { BaseEntity } from '@/common/base.entity.js';
import { createPaginationQuerySchema, withPagination } from '@/schema.js';

type PaginatedParameters = FromSchema<ReturnType<typeof createPaginationQuerySchema>>;

export async function getListCursor<T extends BaseEntity>(
  where: FilterQuery<T>,
  {
    after,
    before,
    limit,
    order,
    order_by,
    populate,
    filters
  }: PaginatedParameters & FindByCursorOptions<T, any, any>,
  repo: EntityRepository<any> // TODO: better typing,
): Promise<Cursor<T>> {
  const aftr = after ? await repo.findOneOrFail({ id: after }, { filters }) : undefined;
  const bfr = before ? await repo.findOneOrFail({ id: before }, { filters }) : undefined;
  const cursor = await repo.findByCursor(where, {
    ...(bfr ? { last: limit } : { first: limit }),
    before: bfr && { [snakeToCamel(order_by)]: bfr[snakeToCamel(order_by) as keyof T], id: bfr.id },
    after: aftr && {
      [snakeToCamel(order_by)]: aftr[snakeToCamel(order_by) as keyof T],
      id: aftr.id
    },
    orderBy: [{ [snakeToCamel(order_by)]: order }, { id: order }],
    populate,
    filters
  });

  return cursor;
}

type PaginatedSchema = FromSchema<ReturnType<typeof withPagination>>;

export async function createPaginatedResponse<T extends BaseEntity, U, V extends string>(
  cursor: Cursor<T, V>,
  toDto: (entity: Loaded<T, V>) => U
) {
  return {
    data: await Promise.all(cursor.items.map(toDto)),
    first_id: cursor.items.at(0)?.id ?? null,
    last_id: cursor.items.at(-1)?.id ?? null,
    has_more: cursor.hasNextPage,
    total_count: cursor.totalCount
  } satisfies PaginatedSchema;
}
