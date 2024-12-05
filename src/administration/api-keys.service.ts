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
import { getOrganizationUser, getProjectPrincipal, redactProjectKeyValue } from './helpers';
import { Project } from './entities/project.entity';
import { OrganizationApiKeysListQuery } from './dtos/organization-api-keys-list';
import { ProjectPrincipal } from './entities/project-principal.entity';
import { PrincipalType } from './entities/principals/principal.entity';
import { OrganizationUserRole, ProjectRole } from './entities/constants';
import { toDto as toProjectDto } from './projects.service.js';
import { toProjectUserDto } from './project-users.service';

import { createDeleteResponse } from '@/utils/delete';
import { generateApiKey, scryptSecret } from '@/auth/utils';
import { getUpdatedValue } from '@/utils/update';
import { createPaginatedResponse, getListCursor } from '@/utils/pagination';
import { ORM } from '@/database';
import { APIError, APIErrorCode } from '@/errors/error.entity';

type LoadedApiKey = Loaded<
  ProjectApiKey,
  'project' | 'createdBy.principal.account' | 'createdBy.principal.user.user'
>;

export function toDto(apiKey: LoadedApiKey, sensitiveId?: string): ApiKeyDto {
  const projectPrincipal = apiKey.createdBy.$;
  return {
    object: 'organization.project.api_key',
    id: apiKey.id,
    name: apiKey.name,
    created_at: dayjs(apiKey.createdAt).unix(),
    secret: typeof sensitiveId === 'string' ? sensitiveId : apiKey.redactedValue,
    project: toProjectDto(apiKey.project.$),
    last_used_at: apiKey.lastUsedAt ? dayjs(apiKey.lastUsedAt).unix() : null,
    owner: {
      type: projectPrincipal.principal.type,
      ...(projectPrincipal.principal.type === PrincipalType.USER
        ? {
            [PrincipalType.USER]: toProjectUserDto(projectPrincipal)
          }
        : { [PrincipalType.SERVICE_ACCOUNT]: null }) // TODO return service account
    }
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
  const key = scryptSecret(keyValue);
  const apiKey = new ProjectApiKey({
    name,
    key,
    createdBy: ref(authorProjectPrincipal),
    project: ref(project),
    redactedValue: redactProjectKeyValue(keyValue)
  });

  await ORM.em.persistAndFlush(apiKey);

  const loadedApiKey = await getApiKey({ project_id: apiKey.project.id, api_key_id: apiKey.id });
  return toDto(loadedApiKey, keyValue);
}

async function getApiKey({
  project_id,
  api_key_id
}: {
  project_id: string;
  api_key_id: string;
}): Promise<LoadedApiKey> {
  const projectPrincipal = getProjectPrincipal();
  // validate project is inside the Org
  const project = await ORM.em.getRepository(Project).findOneOrFail({ id: project_id });
  if (projectPrincipal.project.id !== project.id) {
    throw new APIError({
      message: 'Project user mismatch',
      code: APIErrorCode.INVALID_INPUT
    });
  }
  const apiKey = await ORM.em.getRepository<LoadedApiKey>(ProjectApiKey).findOneOrFail(
    { id: api_key_id, project: project_id },
    {
      populate: ['project', 'createdBy.principal.account', 'createdBy.principal.user.user' as any]
    }
  );

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
  const filter: FilterQuery<LoadedApiKey> = { project: project_id };

  const cursor = await getListCursor<LoadedApiKey>(
    filter,
    {
      limit,
      order,
      order_by,
      after,
      before,
      populate: ['project', 'createdBy.principal.account', 'createdBy.principal.user.user']
    },
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

export async function listOrganizationApiKeys({
  limit,
  order,
  order_by,
  after,
  before,
  search
}: OrganizationApiKeysListQuery) {
  const filter: FilterQuery<LoadedApiKey> = {};
  const organizationUser = getOrganizationUser();

  if (organizationUser.role !== OrganizationUserRole.OWNER) {
    // get all project principals for organization user
    const projectPrincipals = await ORM.em.getRepository(ProjectPrincipal).find(
      {
        principal: { type: PrincipalType.USER, user: ref(organizationUser) }
      },
      { filters: { projectAdministrationAccess: false } }
    );

    filter.$or = projectPrincipals.map((principal) =>
      principal.role === ProjectRole.ADMIN
        ? { project: principal.project }
        : {
            createdBy: principal.id,
            project: principal.project
          }
    );
  } else {
    // get all project for organization user
    const projects = await ORM.em.getRepository(Project).findAll();
    // filter api-keys only by project
    filter.project = { $in: projects.map((p) => p.id) };
  }

  if (search) {
    const regexp = new RegExp(search, 'i');
    filter.name = regexp;
  }

  const cursor = await getListCursor<LoadedApiKey>(
    filter,
    {
      limit,
      order,
      order_by,
      after,
      before,
      filters: { projectAdministrationAccess: false },
      populate: ['project', 'createdBy.principal.account', 'createdBy.principal.user.user']
    },
    ORM.em.getRepository(ProjectApiKey)
  );
  return createPaginatedResponse(cursor, toDto);
}
