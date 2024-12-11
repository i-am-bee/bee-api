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

import { ChangeSetType, Entity, ManyToOne, PrimaryKey, Property, ref, Ref } from '@mikro-orm/core';
import { User } from '@zilliz/milvus2-sdk-node';
import { requestContext } from '@fastify/request-context';

import { generatePrefixedObjectId } from '@/utils/id.js';
import { ProjectPrincipal } from '@/administration/entities/project-principal.entity';

@Entity()
export class Log {
  @PrimaryKey({ fieldName: '_id' })
  id = generatePrefixedObjectId('log');

  @Property()
  createdAt: Date = new Date();

  @ManyToOne()
  projectPrincipal?: Ref<ProjectPrincipal>;

  @ManyToOne()
  user?: Ref<User>;

  @Property()
  entity?: string;

  @Property()
  entityId?: string;

  @Property()
  type?: ChangeSetType;

  @Property()
  change?: any;

  @Property()
  additionalData: any;

  constructor({ entity, entityId, type, change, additionalData }: LogInput) {
    const user = requestContext.get('user');
    if (user) {
      this.user = ref(user);
    }
    const projectPrincipal = requestContext.get('projectPrincipal');
    if (projectPrincipal) {
      this.projectPrincipal = ref(projectPrincipal);
    }
    this.entity = entity;
    this.entityId = entityId;
    this.type = type;
    this.change = change;
    this.additionalData = additionalData;
  }
}

export type LogInput = Partial<
  Pick<Log, 'entity' | 'entityId' | 'type' | 'change' | 'additionalData'>
>;
