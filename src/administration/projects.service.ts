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
import { requestContext } from '@fastify/request-context';
import dayjs from 'dayjs';

import { ProjectCreateBody, ProjectCreateResponse } from './dtos/project-create';
import { Project, ProjectStatus, ProjectVisiblity } from './entities/project.entity';
import { Project as ProjectDto } from './dtos/project';
import { ProjectsListQuery, ProjectsListResponse } from './dtos/projects-list';
import { ProjectPrincipal } from './entities/project-principal.entity';
import { UserPrincipal } from './entities/principals/user-principal.entity';
import { OrganizationUserRole, ProjectRole } from './entities/constants';
import { getOrganizationUser } from './helpers';
import { ProjectReadParams, ProjectReadResponse } from './dtos/project-read';
import {
  ProjectUpdateBody,
  ProjectUpdateParams,
  ProjectUpdateResponse
} from './dtos/project-update';
import { ProjectArchiveParams, ProjectArchiveResponse } from './dtos/project-archive';
import { PrincipalType } from './entities/principals/principal.entity';

import { ORM } from '@/database';
import { createPaginatedResponse, getListCursor } from '@/utils/pagination';
import { APIError, APIErrorCode } from '@/errors/error.entity';
import { getUpdatedValue } from '@/utils/update';
import { User } from '@/users/entities/user.entity';

export function toDto(project: Loaded<Project>): ProjectDto {
  return {
    object: 'organization.project',
    id: project.id,
    name: project.name,
    visibility: project.visibility,
    status: project.status,
    created_at: dayjs(project.createdAt).unix(),
    archived_at: project.archivedAt ? dayjs(project.archivedAt).unix() : null
  };
}

export async function createProject({
  name,
  visibility
}: ProjectCreateBody): Promise<ProjectCreateResponse> {
  const orgUser = getOrganizationUser();

  if (orgUser.role === OrganizationUserRole.MEMBER && visibility === ProjectVisiblity.PUBLIC) {
    throw new APIError({
      message: 'Members can only create private projects',
      code: APIErrorCode.INVALID_INPUT
    });
  }

  const project = new Project({ name, visibility });
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

  await ORM.em.persistAndFlush([project, projectPrincipal]);

  return toDto(project);
}

export async function readProject({ project_id }: ProjectReadParams): Promise<ProjectReadResponse> {
  const project = await ORM.em.getRepository(Project).findOneOrFail({ id: project_id });
  return toDto(project);
}

export async function updateProject({
  project_id,
  name,
  visibility
}: ProjectUpdateParams & ProjectUpdateBody): Promise<ProjectUpdateResponse> {
  const project = await ORM.em.getRepository(Project).findOneOrFail({ id: project_id });

  if (project.status === ProjectStatus.ARCHIVED)
    throw new APIError({
      message: "Archived project can't be modified",
      code: APIErrorCode.FORBIDDEN
    });

  project.name = getUpdatedValue(name, project.name);
  project.visibility = getUpdatedValue(visibility, project.visibility);
  await ORM.em.flush();

  return toDto(project);
}

export async function listProjects({
  limit,
  order,
  order_by,
  after,
  before,
  include_archived
}: ProjectsListQuery): Promise<ProjectsListResponse> {
  const orgUser = getOrganizationUser();
  const principals = await ORM.em
    .getRepository(ProjectPrincipal)
    .find(
      { principal: { type: PrincipalType.USER, user: orgUser } },
      { filters: { projectAdministrationAccess: false } }
    ); // TODO missing pagination

  const filter: FilterQuery<Project> = {
    $and: [
      {
        $or: [
          { id: { $in: principals.map(({ project }) => project.id) } },
          { visibility: ProjectVisiblity.PUBLIC }
        ]
      }
    ]
  };

  if (!include_archived) {
    filter.$and!.push({ status: ProjectStatus.ACTIVE });
  }

  const cursor = await getListCursor<Project>(
    filter,
    { limit, order, order_by, after, before },
    ORM.em.getRepository(Project)
  );
  return createPaginatedResponse(cursor, toDto);
}

export async function archiveProject({
  project_id
}: ProjectArchiveParams): Promise<ProjectArchiveResponse> {
  const user = await ORM.em.getRepository(User).findOne({ defaultProject: project_id });
  if (user) {
    throw new APIError({
      message: 'Can not archive default project.',
      code: APIErrorCode.FORBIDDEN
    });
  }
  const project = await ORM.em.getRepository(Project).findOneOrFail({ id: project_id });

  project.archive();
  await ORM.em.flush();

  return toDto(project);
}
