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
import { OrganizationUserRole, ProjectRole } from '@/administration/entities/constants.js';
import { Project } from '@/administration/entities/project.entity.js';
import { Organization } from '@/administration/entities/organization.entity.js';
import { IBM_ORGANIZATION_OWNER_ID } from '@/config.js';

const getUserLogger = (userId: string) => getServiceLogger('user').child({ userId });

function toDto(user: Loaded<User>): UserDto {
  return {
    id: user.id,
    object: 'user',
    external_id: user.externalId,
    email: user.email ?? null,
    name: user.name ?? null,
    metadata: user.metadata,
    default_organization: user.defaultOrganization.id,
    default_project: user.defaultProject.id
  };
}

export async function createUser({
  externalId,
  email,
  name,
  metadata
}: Pick<UserInput, 'externalId' | 'email' | 'name'> & UserCreateBody): Promise<UserCreateResponse> {
  const user = new User({
    externalId,
    email,
    name,
    metadata,
    defaultOrganization: ORM.em
      .getRepository(Organization)
      .getReference('placeholder', { wrapped: true }),
    defaultProject: ORM.em.getRepository(Project).getReference('placeholder', { wrapped: true })
  });

  let orgUser: OrganizationUser | null = null;
  let organization: Organization | null = null;
  if (email && (email.endsWith('@ibm.com') || email.endsWith('.ibm.com'))) {
    const defaultOrgOwner = await ORM.em
      .getRepository(OrganizationUser)
      .findOneOrFail(
        { id: IBM_ORGANIZATION_OWNER_ID },
        { filters: { orgAdministrationAccess: false }, populate: ['organization'] }
      );
    organization = defaultOrgOwner.organization.$;
    // Become org owner
    requestContext.set('organizationUser', defaultOrgOwner);
    orgUser = new OrganizationUser({
      user: ref(user),
      role: OrganizationUserRole.MEMBER
    });
  } else {
    organization = new Organization({
      name: `${name}'s organization`,
      createdBy: ref(user)
    });

    orgUser = new OrganizationUser({
      user: ref(user),
      role: OrganizationUserRole.OWNER,
      organization: ref(organization),
      createdBy: ORM.em
        .getRepository(OrganizationUser)
        .getReference('placeholder', { wrapped: true })
    });
    orgUser.createdBy = ORM.em
      .getRepository(OrganizationUser)
      .getReference(orgUser.id, { wrapped: true }); // Bypass chicken-egg problem
    requestContext.set('organizationUser', orgUser);
  }

  const project = new Project({ name: `${name}'s project`, visibility: 'private' });
  const projectPrincipal = new ProjectPrincipal({
    project: ref(project),
    createdBy: ORM.em
      .getRepository(ProjectPrincipal)
      .getReference('placeholder', { wrapped: true }),
    principal: new UserPrincipal({ user: ref(orgUser) }),
    role: ProjectRole.ADMIN
  });
  projectPrincipal.createdBy = ORM.em
    .getRepository(ProjectPrincipal)
    .getReference(projectPrincipal.id, { wrapped: true }); // Bypass chicken-egg problem
  requestContext.set('projectPrincipal', projectPrincipal);

  user.defaultOrganization = ORM.em
    .getRepository(Organization)
    .getReference(organization.id, { wrapped: true });
  user.defaultProject = ORM.em.getRepository(Project).getReference(project.id, { wrapped: true });

  await ORM.em.persistAndFlush([user, organization, orgUser, project, projectPrincipal]);
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
