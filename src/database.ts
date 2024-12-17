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

import { MongoDriver, MikroORM, EntityRepository } from '@mikro-orm/mongodb';
import { RequestContext } from '@mikro-orm/core';
import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import config from './mikro-orm.config.js';
import { getLogger } from './logger.js';
import { Chat } from './chat/entities/chat.entity.js';
import { BaseEntity } from './common/base.entity.js';

export const ORM = await MikroORM.init<MongoDriver>({
  ...config,
  logger: (msg) => getLogger().trace(msg)
});
await ORM.schema.createSchema();
await ensureTTLIndexes();

export const databasePlugin: FastifyPluginAsync = fp.default(async (app) => {
  app.addHook('preHandler', (request, reply, done) => {
    RequestContext.create(ORM.em, done);
  });
});

interface Index {
  v: number;
  key: Record<string, number>;
  name: string;
  expireAfterSeconds?: number;
}

async function ensureTTLIndexes() {
  const expireAfterSeconds = 14 * 7 * 24 * 60 * 60; // 14 days
  const targetedEntities = [Chat];

  await Promise.all(
    targetedEntities.map((entity) =>
      ensureTTLIndexSafe({
        entityRepository: ORM.em.getRepository(entity),
        expireAfterSeconds
      })
    )
  );
}

async function ensureTTLIndexSafe<T extends BaseEntity>({
  entityRepository,
  expireAfterSeconds
}: {
  entityRepository: EntityRepository<T>;
  expireAfterSeconds: number;
}) {
  const indexName = `createdAt_ttl_1`;
  const { collectionName } = entityRepository.getCollection();

  const logger = getLogger().child({ indexName, expireAfterSeconds, collectionName });

  try {
    const indexes: Index[] = await entityRepository.getCollection().listIndexes().toArray();
    const TTLIndex = indexes.find((index) => index.name === indexName);

    if (TTLIndex && TTLIndex.expireAfterSeconds) {
      if (TTLIndex.expireAfterSeconds > expireAfterSeconds) {
        throw new Error(
          `Cannot decrease the expireAfterSeconds setting. The recommended approach is to manually delete documents in small batches and delete the index manually before re-creating the TTL index. This helps control the impact on your cluster.`
        );
      } else if (TTLIndex.expireAfterSeconds < expireAfterSeconds) {
        await entityRepository
          .getEntityManager()
          .getDriver()
          .getConnection()
          .getDb()
          .command({
            collMod: collectionName,
            index: {
              expireAfterSeconds: expireAfterSeconds,
              name: indexName
            }
          });
        logger.info('Updated TTL index');
      }
    } else {
      await entityRepository
        .getCollection()
        .createIndex({ createdAt: 1 }, { expireAfterSeconds, name: indexName });
      logger.info('Created TTL index');
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to ensure TTL index');
  }
}
