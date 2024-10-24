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

import { Entity, EventArgs, Property } from '@mikro-orm/core';
import { requestContext } from '@fastify/request-context';

import {
  ProjectAdministrationScopedEntity,
  ProjectAdministrationScopedEntityInput
} from './project-administration-scoped.entity';

import { inSeeder } from '@/context';

@Entity()
export class ProjectApiKey extends ProjectAdministrationScopedEntity {
  getIdPrefix(): string {
    return 'key';
  }

  @Property()
  name: string;

  @Property()
  key: string;

  @Property()
  redactedValue: string;

  constructor({ key, name, redactedValue, ...rest }: ProjectApiKeyInput) {
    super(rest);
    this.key = key;
    this.name = name;
    this.redactedValue = redactedValue;
  }

  override async authorize(_: EventArgs<any>) {
    if (inSeeder()) return;
    const projectPrincipal = requestContext.get('projectPrincipal');
    if (projectPrincipal && this.createdBy.id === projectPrincipal.id) return;
    super.authorize(_);
  }
}

export type ProjectApiKeyInput = ProjectAdministrationScopedEntityInput &
  Pick<ProjectApiKey, 'key' | 'name' | 'redactedValue'>;
