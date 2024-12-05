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

import { Loaded, ref } from '@mikro-orm/core';
import { requestContext } from '@fastify/request-context';

import { UserReadResponse } from './dtos/user-read.js';
import { UserCreateBody, UserCreateResponse } from './dtos/user-create.js';
import { User, UserInput } from './entities/user.entity.js';
import type { User as UserDto } from './dtos/user.js';
import { UserUpdateBody, UserUpdateResponse } from './dtos/user-update.js';
import { getUser } from './helpers.js';

import { ORM } from '@/database.js';
import { getServiceLogger } from '@/logger.js';
import { getUpdatedValue } from '@/utils/update.js';
import { OrganizationUser } from '@/administration/entities/organization-user.entity.js';
import { ProjectPrincipal } from '@/administration/entities/project-principal.entity.js';
import { UserPrincipal } from '@/administration/entities/principals/user-principal.entity.js';
import { ORGANIZATION_OWNER_ID_DEFAULT, PROJECT_ADMIN_ID_DEFAULT } from '@/config.js';
import { OrganizationUserRole, ProjectRole } from '@/administration/entities/constants.js';

const getUserLogger = (userId: string) => getServiceLogger('user').child({ userId });

function toDto(user: Loaded<User>): UserDto {
  return {
    id: user.id,
    object: 'user',
    external_id: user.externalId,
    email: user.email ?? null,
    name: user.name ?? null,
    metadata: user.metadata
  };
}

export async function createUser({
  externalId,
  email,
  name,
  metadata
}: Pick<UserInput, 'externalId' | 'email' | 'name'> & UserCreateBody): Promise<UserCreateResponse> {
  const user = new User({ externalId, email, name, metadata });

  const defaultOrgOwner = await ORM.em
    .getRepository(OrganizationUser)
    .findOneOrFail(
      { id: ORGANIZATION_OWNER_ID_DEFAULT },
      { filters: { orgAdministrationAccess: false } }
    );
  const defaultProjectAdmin = await ORM.em
    .getRepository(ProjectPrincipal)
    .findOneOrFail(
      { id: PROJECT_ADMIN_ID_DEFAULT },
      { filters: { projectAdministrationAccess: false } }
    );

  // Become org owner
  requestContext.set('organizationUser', defaultOrgOwner);
  const orgUser = new OrganizationUser({
    user: ref(user),
    role: OrganizationUserRole.MEMBER
  });

  // Become project admin
  requestContext.set('projectPrincipal', defaultProjectAdmin);
  const projectPrincipal = new ProjectPrincipal({
    principal: new UserPrincipal({ user: ref(orgUser) }),
    role: ProjectRole.READER
  });

  await ORM.em.persistAndFlush([user, orgUser, projectPrincipal]);
  getUserLogger(user.id).info({ externalId, metadata }, 'User created');
  return toDto(user);
}

export async function readUser(_: unknown): Promise<UserReadResponse> {
  const user = getUser();
  return toDto(user);
}

export async function updateUser({ name, metadata }: UserUpdateBody): Promise<UserUpdateResponse> {
  const user = getUser();
  user.name = getUpdatedValue(name, user.name);
  user.metadata = getUpdatedValue(metadata, user.metadata);
  await ORM.em.flush();
  getUserLogger(user.id).info({ metadata }, 'User updated');
  return toDto(user);
}
