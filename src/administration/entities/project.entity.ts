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

import { Entity, Enum, EventArgs, Property } from '@mikro-orm/core';

import { getProjectPrincipal } from '../helpers';

import {
  OrganizationAdministrationScopedEntity,
  OrganizationAdministrationScopedEntityInput
} from './organization-administration-scoped.entity';
import { ProjectRole } from './constants';

import { APIError, APIErrorCode } from '@/errors/error.entity';

export const ProjectStatus = {
  ACTIVE: 'active',
  ARCHIVED: 'archived'
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

@Entity()
export class Project extends OrganizationAdministrationScopedEntity {
  getIdPrefix(): string {
    return 'proj';
  }

  @Property()
  name: string;

  @Enum(() => ProjectStatus)
  status: ProjectStatus;

  @Property()
  archivedAt?: Date;

  constructor({ name, status = ProjectStatus.ACTIVE, ...rest }: ProjectInput) {
    super(rest);

    this.name = name;
    this.status = status;
  }

  override delete(): void {
    throw new Error("Projects can't be deleted, only archived");
  }

  archive() {
    this.archivedAt = new Date();
    this.status = ProjectStatus.ARCHIVED;
  }

  override async authorize(_: EventArgs<any>) {
    try {
      await super.authorize(_);
    } catch (err) {
      if (err instanceof APIError && err.code === APIErrorCode.FORBIDDEN) {
        const projectPrincipal = getProjectPrincipal();
        if (projectPrincipal.project.id === this.id && projectPrincipal.role === ProjectRole.ADMIN)
          return;
      }
      throw err;
    }
  }
}

export type ProjectInput = OrganizationAdministrationScopedEntityInput &
  Pick<Project, 'name'> &
  Pick<Partial<Project>, 'status'>;
