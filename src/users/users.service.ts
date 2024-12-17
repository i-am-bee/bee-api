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
import { Assistant } from '@/assistants/assistant.entity.js';
import { Agent, getDefaultModel } from '@/runs/execution/constants.js';
import { SystemTools } from '@/tools/entities/tool-calls/system-call.entity.js';
import { VECTOR_STORE_DEFAULT_MAX_NUM_RESULTS } from '@/vector-stores/constants.js';
import { SystemUsage } from '@/tools/entities/tool-usages/system-usage.entity.js';
import { FileSearchUsage } from '@/tools/entities/tool-usages/file-search-usage.entity.js';
import { CodeInterpreterUsage } from '@/tools/entities/tool-usages/code-interpreter-usage.entity.js';

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

  const assistant = new Assistant({
    model: getDefaultModel(),
    agent: Agent.BEE,
    tools: [
      new SystemUsage({ toolId: SystemTools.WEB_SEARCH }),
      new SystemUsage({ toolId: SystemTools.READ_FILE }),
      new FileSearchUsage({ maxNumResults: VECTOR_STORE_DEFAULT_MAX_NUM_RESULTS }),
      new CodeInterpreterUsage()
    ],
    name: 'Bee',
    project: ref(project),
    createdBy: ref(projectPrincipal),
    description: 'A general purpose agent for everyday tasks',
    metadata: {
      $ui_color: 'black',
      $ui_icon: 'Bee',
      '$ui_starterQuestion_c9f7253b-4fb3-4b2c-b576-d783f399ab6d':
        'Summarize key findings and methodology of the attached research paper.',
      '$ui_starterQuestion_9207fe3c-9a01-4e37-bdf8-ddfbe9114397':
        'Bring me up to speed on the latest news and developments in the field of agentic AI. Be sure to cite your sources.',
      '$ui_starterQuestion_919aa137-f90c-4580-b587-ab73d3d6b4b1':
        'Search for the top 5 most popular programming languages in 2024 and create a bar chart comparing the relative popularity of each language.'
    }
  });

  await ORM.em.persistAndFlush([user, organization, orgUser, project, projectPrincipal, assistant]);
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
