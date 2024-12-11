import { ChangeSetType, EventSubscriber, FlushEventArgs } from '@mikro-orm/core';

import { Log } from './log.entity';
import { BaseEntity } from './base.entity';

import { inJob, inSeeder } from '@/context';

const loggedEntities: { [key: string]: { types?: ChangeSetType[]; entities: string[] } } = {
  Assistant: {
    entities: ['project', 'agent']
  },
  Artifact: {
    entities: ['project', 'thread', 'name']
  },
  Chat: {
    types: [ChangeSetType.CREATE],
    entities: ['artifact']
  },
  Message: {
    entities: ['project']
  },
  Thread: {
    entities: ['project']
  },
  Tool: {
    entities: ['project', 'name']
  },
  VectorStore: {
    entities: ['project', 'name']
  },
  VectorStoreFile: {
    entities: ['project', 'file']
  },
  File: {
    entities: ['project', 'filename']
  },
  Run: {
    entities: ['project', 'assistant', 'status']
  },
  User: {
    entities: ['email']
  },
  Organization: {
    entities: ['name']
  },
  Project: {
    entities: ['name', 'organization']
  },
  ApiKey: {
    entities: ['project']
  }
};

export class LogSubscriber implements EventSubscriber {
  onFlush(args: FlushEventArgs): void | Promise<void> {
    args.uow.getChangeSets().forEach((cs) => {
      if (
        loggedEntities[cs.name] &&
        (loggedEntities[cs.name].types?.includes(cs.type) ?? true) &&
        inSeeder() === false
      ) {
        if (cs.type === ChangeSetType.DELETE && inJob()) return;

        const log = new Log({
          entity: cs.name,
          entityId: cs.entity?.id,
          type: cs.type,
          change: cs.type === ChangeSetType.UPDATE ? cs.payload : undefined,
          additionalData:
            loggedEntities[cs.name].entities.reduce(
              (acc, name) => ({
                ...acc,
                [name]:
                  cs.entity[name].entity instanceof BaseEntity
                    ? cs.entity[name].id
                    : cs.entity[name]
              }),
              {}
            ) ?? undefined
        });
        args.uow.computeChangeSet(log);
      }
    });
  }
}
