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

import { Entity, ManyToOne, Property, Ref } from '@mikro-orm/core';

import { BaseEntity, BaseEntityInput } from '@/common/base.entity.js';
import { Project } from '@/administration/entities/project.entity';
import { Organization } from '@/administration/entities/organization.entity';

@Entity()
export class User extends BaseEntity {
  getIdPrefix(): string {
    return 'user';
  }

  @Property({ unique: true })
  externalId: string; // Remove after all users have migrated

  @Property({ unique: true })
  email?: string;

  @Property()
  name?: string;

  @ManyToOne()
  defaultOrganization: Ref<Organization>;

  @ManyToOne()
  defaultProject: Ref<Project>;

  constructor({
    externalId,
    email,
    name,
    defaultOrganization,
    defaultProject,
    ...rest
  }: UserInput) {
    super(rest);
    this.externalId = externalId;
    this.email = email;
    this.name = name;
    this.defaultOrganization = defaultOrganization;
    this.defaultProject = defaultProject;
  }
}

export type UserInput = BaseEntityInput &
  Pick<User, 'externalId' | 'name' | 'email' | 'defaultOrganization' | 'defaultProject'>;
