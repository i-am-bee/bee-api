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

import { ref, type EntityManager } from '@mikro-orm/core';
import { Seeder } from '@mikro-orm/seeder';

import { OrganizationUserRole, ProjectRole } from '@/administration/entities/constants';
import { OrganizationUser } from '@/administration/entities/organization-user.entity';
import { Organization } from '@/administration/entities/organization.entity';
import { UserPrincipal } from '@/administration/entities/principals/user-principal.entity';
import { ProjectPrincipal } from '@/administration/entities/project-principal.entity';
import { Project } from '@/administration/entities/project.entity';
import { Assistant } from '@/assistants/assistant.entity';
import { User } from '@/users/entities/user.entity';
import { SystemTools } from '@/tools/entities/tool-calls/system-call.entity';
import { ProjectApiKey } from '@/administration/entities/project-api-key.entity';
import { API_KEY_PREFIX, scryptSecret } from '@/auth/utils';
import { IBM_ORGANIZATION_OWNER_ID } from '@/config';
import { redactProjectKeyValue } from '@/administration/helpers';
import { Agent, getDefaultModel } from '@/runs/execution/constants';

const USER_EXTERNAL_ID = 'test';
const PROJECT_API_KEY = `${API_KEY_PREFIX}testkey`;

export class DatabaseSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    process.env.IN_SEEDER = 'true';

    const existingUser = await em.getRepository(User).findOne({ externalId: USER_EXTERNAL_ID });
    if (existingUser) {
      throw new Error('Database is already seeded.');
    }

    const user = new User({
      externalId: USER_EXTERNAL_ID,
      name: 'Test user',
      email: 'test@email.com',
      defaultOrganization: em
        .getRepository(Organization)
        .getReference('placeholder', { wrapped: true }),
      defaultProject: em.getRepository(Project).getReference('placeholder', { wrapped: true })
    });
    const organization = new Organization({ createdBy: ref(user), name: 'Default Organization' });
    const organizationUser = new OrganizationUser({
      user: ref(user),
      role: OrganizationUserRole.OWNER,
      organization: ref(organization),
      createdBy: em.getRepository(OrganizationUser).getReference('placeholder', { wrapped: true })
    });
    organizationUser.id = IBM_ORGANIZATION_OWNER_ID;
    organizationUser.createdBy = em
      .getRepository(OrganizationUser)
      .getReference(organizationUser.id, { wrapped: true });
    const project = new Project({
      name: 'Default project',
      createdBy: ref(organizationUser),
      organization: ref(organization)
    });
    const projectUser = new ProjectPrincipal({
      principal: new UserPrincipal({ user: ref(organizationUser) }),
      role: ProjectRole.ADMIN,
      createdBy: em.getRepository(ProjectPrincipal).getReference('placeholder', { wrapped: true }),
      project: ref(project)
    });
    user.defaultOrganization = em
      .getRepository(Organization)
      .getReference(organization.id, { wrapped: true });
    user.defaultProject = em.getRepository(Project).getReference(project.id, { wrapped: true });

    projectUser.createdBy = em
      .getRepository(ProjectPrincipal)
      .getReference(projectUser.id, { wrapped: true });
    const projectApiKey = new ProjectApiKey({
      key: scryptSecret(PROJECT_API_KEY),
      name: 'test key',
      createdBy: ref(projectUser),
      project: ref(project),
      redactedValue: redactProjectKeyValue(PROJECT_API_KEY)
    });
    const beeAssistant = new Assistant({
      model: getDefaultModel(),
      agent: Agent.BEE,
      tools: [
        {
          type: 'system',
          toolId: SystemTools.WEB_SEARCH
        },
        {
          type: 'system',
          toolId: SystemTools.WEATHER
        },
        {
          type: 'system',
          toolId: SystemTools.WIKIPEDIA
        },
        {
          type: 'code_interpreter'
        }
      ],
      name: 'Bee Assistant',
      project: ref(project),
      createdBy: ref(projectUser),
      description: 'An example agent powered by ReAct, not tailored to any specific task',
      metadata: {
        $ui_color: 'black',
        $ui_icon: 'Bee'
      }
    });
    const streamlitAssistant = new Assistant({
      model: getDefaultModel(),
      agent: Agent.STREAMLIT,
      tools: [],
      name: 'Builder Assistant',
      project: ref(project),
      createdBy: ref(projectUser),
      description: 'An example streamlit agent, tailored for building Streamlit applications.',
      metadata: {
        $ui_color: 'white',
        $ui_icon: 'Bee'
      }
    });
    em.persist([beeAssistant, streamlitAssistant, projectApiKey]);
    await em.flush();
    process.env.IN_SEEDER = undefined;
  }
}
