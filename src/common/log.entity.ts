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

import { ChangeSetType, Entity, PrimaryKey, Property } from '@mikro-orm/core';
import { requestContext, RequestContextData } from '@fastify/request-context';

import { generatePrefixedObjectId } from '@/utils/id.js';
import { jobLocalStorage } from '@/context';

@Entity()
export class Log {
  @PrimaryKey({ fieldName: '_id' })
  id = generatePrefixedObjectId('log');

  @Property()
  createdAt: Date = new Date();

  @Property()
  requestContext: any = {};

  @Property()
  entity?: string;

  @Property()
  entityId?: string;

  @Property()
  type?: ChangeSetType;

  @Property()
  change?: any;

  @Property()
  additionalData?: any;

  constructor({ entity, entityId, type, change, additionalData }: LogInput) {
    const contextData: (keyof RequestContextData)[] = [
      'user',
      'organizationUser',
      'apiKey',
      'projectPrincipal',
      'artifact'
    ];

    contextData.forEach((key: keyof RequestContextData) => {
      const value = requestContext.get(key);
      if (value) Object.assign(this.requestContext, { [key]: value.id });
    });
    const job = jobLocalStorage.getStore()?.job.name;
    if (job) {
      Object.assign(this.requestContext, { job });
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
