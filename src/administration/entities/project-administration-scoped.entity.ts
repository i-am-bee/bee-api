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

import {
  BeforeCreate,
  BeforeDelete,
  BeforeUpdate,
  Entity,
  EventArgs,
  Filter,
  Index,
  ManyToOne,
  ref,
  Ref
} from '@mikro-orm/core';
import { requestContext } from '@fastify/request-context';

import { BaseEntity, BaseEntityInput } from '../../common/base.entity.js';

import { getOrganizationUser, getProjectPrincipal } from '@/administration/helpers.js';
import type { Project } from '@/administration/entities/project.entity.js';
import type { ProjectPrincipal } from '@/administration/entities/project-principal.entity.js';
import { OrganizationUserRole, ProjectRole } from '@/administration/entities/constants.js';
import { APIError, APIErrorCode } from '@/errors/error.entity.js';
import { inJob, inSeeder } from '@/context.js';

export const projectAdministrationAccessFilter = async (
  _ = {},
  type: 'read' | 'update' | 'delete'
) => {
  if (inJob() || inSeeder()) return;

  const orgUser = requestContext.get('organizationUser');
  if (orgUser?.role === OrganizationUserRole.OWNER && type === 'read') {
    return;
  }

  const projectPrincipal = requestContext.get('projectPrincipal');
  if (!projectPrincipal) return { _id: null };

  switch (type) {
    case 'read':
      if (projectPrincipal.role === ProjectRole.ADMIN) return { project: projectPrincipal.project };
      else
        return {
          createdBy: projectPrincipal.id,
          project: projectPrincipal.project
        };
    default:
      throw new Error('Not Implemented');
  }
};

@Entity({ abstract: true })
@Filter({
  name: 'projectAdministrationAccess',
  cond: projectAdministrationAccessFilter,
  default: true
})
export abstract class ProjectAdministrationScopedEntity extends BaseEntity {
  @Index()
  @ManyToOne()
  project: Ref<Project>;

  @ManyToOne()
  createdBy: Ref<ProjectPrincipal>;

  constructor({ project, createdBy, ...rest }: ProjectAdministrationScopedEntityInput) {
    super(rest);

    if (project && createdBy) {
      this.project = project;
      this.createdBy = createdBy;
    } else {
      const projectPrincipal = getProjectPrincipal();

      this.project = projectPrincipal.project;
      this.createdBy = ref(projectPrincipal);
    }
  }

  @BeforeCreate()
  @BeforeUpdate()
  @BeforeDelete()
  async authorize(_: EventArgs<any>) {
    if (inJob() || inSeeder()) return;

    const orgUser = getOrganizationUser();
    if (orgUser.role === OrganizationUserRole.OWNER) {
      return;
    }

    const projectPrincipal = getProjectPrincipal();
    if (
      projectPrincipal.role !== ProjectRole.ADMIN ||
      this.project.id !== projectPrincipal.project.id
    )
      throw new APIError({
        message: 'Insufficient project role',
        code: APIErrorCode.FORBIDDEN
      });
  }
}

export type ProjectAdministrationScopedEntityInput = BaseEntityInput &
  Partial<Pick<ProjectAdministrationScopedEntity, 'project' | 'createdBy'>>;
