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

import { ChangeSetType, EventSubscriber, FlushEventArgs } from '@mikro-orm/core';

import { Log } from './log.entity';
import { BaseEntity } from './base.entity';

import { inJob, inSeeder } from '@/context';
import { getLogger } from '@/logger';

const loggedEntities: { [key: string]: { types?: ChangeSetType[]; entities: string[] } } = {
  assistant: {
    entities: ['project', 'agent']
  },
  artifact: {
    entities: ['project', 'thread', 'name']
  },
  chat: {
    types: [ChangeSetType.CREATE],
    entities: []
  },
  message: {
    entities: ['project', 'thread']
  },
  thread: {
    entities: ['project']
  },
  tool: {
    entities: ['project', 'name']
  },
  'vector-store': {
    entities: ['project', 'name', 'dependsOn']
  },
  'vector-store-file': {
    entities: ['project', 'file', 'dependsOn']
  },
  file: {
    entities: ['project', 'filename', 'dependsOn']
  },
  run: {
    entities: ['project', 'assistant', 'status', 'thread']
  },
  user: {
    entities: ['email']
  },
  organization: {
    entities: ['name']
  },
  project: {
    entities: ['name', 'organization']
  },
  'project-api-key': {
    entities: ['project']
  }
};

export class LogSubscriber implements EventSubscriber {
  onFlush(args: FlushEventArgs): void | Promise<void> {
    try {
      args.uow.getChangeSets().forEach((cs) => {
        if (
          loggedEntities[cs.collection] &&
          (loggedEntities[cs.collection].types?.includes(cs.type) ?? true) &&
          inSeeder() === false
        ) {
          // Do not log cleanup deletes from jobs
          if (cs.type === ChangeSetType.DELETE && inJob()) return;

          const log = new Log({
            entity: cs.name,
            entityId: cs.entity?.id,
            type: cs.type,
            // save changes only for update operation
            change: cs.type === ChangeSetType.UPDATE ? cs.payload : undefined,
            ...(loggedEntities[cs.collection].entities.length > 0
              ? {
                  additionalData: loggedEntities[cs.collection].entities.reduce(
                    (acc, name) => ({
                      ...acc,
                      [name]:
                        cs.entity[name]?.entity instanceof BaseEntity
                          ? cs.entity[name].id
                          : cs.entity[name]
                    }),
                    {}
                  )
                }
              : {})
          });
          args.uow.computeChangeSet(log);
        }
      });
    } catch (e) {
      getLogger().warn(e, 'Error during database logging.');
    }
  }
}
