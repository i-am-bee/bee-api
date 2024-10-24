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

import { FilterQuery, Loaded, ref } from '@mikro-orm/core';
import dayjs from 'dayjs';

import { ProjectApiKey } from './entities/project-api-key.entity';
import { ApiKey as ApiKeyDto } from './dtos/api-key';
import { ApiKeyCreateBody, ApiKeyCreateParams, ApiKeyCreateResponse } from './dtos/api-key-create';
import { ApiKeyReadParams, ApiKeyReadResponse } from './dtos/api-key-read';
import { ApiKeyUpdateBody, ApiKeyUpdateParams, ApiKeyUpdateResponse } from './dtos/api-key-update';
import { ApiKeysListParams, ApiKeysListQuery, ApiKeysListResponse } from './dtos/api-keys-list';
import { ApiKeyDeleteParams, ApiKeyDeleteResponse } from './dtos/api-key-delete';
import { getProjectPrincipal } from './helpers';
import { Project } from './entities/project.entity';

import { createDeleteResponse } from '@/utils/delete';
import { API_KEY_PREFIX, generateApiKey, scryptApiKey } from '@/auth/utils';
import { getUpdatedValue } from '@/utils/update';
import { createPaginatedResponse, getListCursor } from '@/utils/pagination';
import { ORM } from '@/database';
import { APIError, APIErrorCode } from '@/errors/error.entity';

export function toDto(apiKey: Loaded<ProjectApiKey>, sensitiveId?: string): ApiKeyDto {
  return {
    object: 'organization.project.api_key',
    id: apiKey.id,
    name: apiKey.name,
    created_at: dayjs(apiKey.createdAt).unix(),
    secret: typeof sensitiveId === 'string' ? sensitiveId : apiKey.redactedValue
  };
}

export async function createApiKey({
  name,
  project_id
}: ApiKeyCreateBody & ApiKeyCreateParams): Promise<ApiKeyCreateResponse> {
  const authorProjectPrincipal = getProjectPrincipal();
  const project = await ORM.em.getRepository(Project).findOneOrFail({ id: project_id });
  if (authorProjectPrincipal.project.id !== project.id) {
    throw new APIError({
      message: 'Project user mismatch',
      code: APIErrorCode.INVALID_INPUT
    });
  }
  const keyValue = generateApiKey();
  const key = scryptApiKey(keyValue);
  const apiKey = new ProjectApiKey({
    name,
    key,
    createdBy: ref(authorProjectPrincipal),
    project: ref(project),
    redactedValue: redactProjectKeyValue(keyValue)
  });

  await ORM.em.persistAndFlush(apiKey);

  return toDto(apiKey, keyValue);
}

export const redactProjectKeyValue = (key: string) =>
  key.replace(
    key.substring(API_KEY_PREFIX.length + 2, key.length - 2),
    '*'.repeat(key.length - 12)
  );

async function getApiKey({ project_id, api_key_id }: { project_id: string; api_key_id: string }) {
  const projectPrincipal = getProjectPrincipal();
  // validate project is inside the Org
  const project = await ORM.em.getRepository(Project).findOneOrFail({ id: project_id });
  if (projectPrincipal.project.id !== project.id) {
    throw new APIError({
      message: 'Project user mismatch',
      code: APIErrorCode.INVALID_INPUT
    });
  }
  const apiKey = await ORM.em
    .getRepository(ProjectApiKey)
    .findOneOrFail({ id: api_key_id, project: project_id });

  return apiKey;
}

export async function readApiKey({
  api_key_id,
  project_id
}: ApiKeyReadParams): Promise<ApiKeyReadResponse> {
  const apiKey = await getApiKey({ project_id, api_key_id });
  return toDto(apiKey);
}

export async function updateApiKey({
  api_key_id,
  project_id,
  name
}: ApiKeyUpdateParams & ApiKeyUpdateBody): Promise<ApiKeyUpdateResponse> {
  const apiKey = await getApiKey({ project_id, api_key_id });

  apiKey.name = getUpdatedValue(name, apiKey.name);
  await ORM.em.flush();

  return toDto(apiKey);
}

export async function listApiKeys({
  limit,
  order,
  order_by,
  after,
  before,
  project_id
}: ApiKeysListQuery & ApiKeysListParams): Promise<ApiKeysListResponse> {
  // validate project is in the org
  await ORM.em.getRepository(Project).findOneOrFail({ id: project_id });
  const filter: FilterQuery<ProjectApiKey> = { project: project_id };

  const cursor = await getListCursor<ProjectApiKey>(
    filter,
    { limit, order, order_by, after, before },
    ORM.em.getRepository(ProjectApiKey)
  );
  return createPaginatedResponse(cursor, toDto);
}

export async function deleteApiKey({
  api_key_id,
  project_id
}: ApiKeyDeleteParams): Promise<ApiKeyDeleteResponse> {
  const apiKey = await getApiKey({ project_id, api_key_id });

  apiKey.delete();
  await ORM.em.flush();

  return createDeleteResponse(api_key_id, 'organization.project.api_key');
}
