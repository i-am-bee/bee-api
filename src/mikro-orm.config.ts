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

import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

import { LoadStrategy, Options } from '@mikro-orm/core';
import { MongoDriver } from '@mikro-orm/mongodb';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import { Migrator } from '@mikro-orm/migrations-mongodb';
import { SeedManager } from '@mikro-orm/seeder';

import { MONGODB_CA_CERT, MONGODB_DATABASE_NAME, MONGODB_URL } from './config.js';
import { LogSubscriber } from './common/log.subscriber.js';

if (process.env.NODE_ENV === 'production') {
  process.env.MIKRO_ORM_NO_COLOR = 'true';
}

const baseConfig = {
  metadataProvider: TsMorphMetadataProvider,
  debug: process.env.NODE_ENV !== 'production' ? true : ['query', 'info'],

  /**
   * We are having some ECONNRESET errors on the DIPC cluster. Seems like problem with f5 load balancer.
   * These seems could help to fix the issue. Motivated by:
   * https://github.com/strapi/strapi/issues/8117#issuecomment-702559536
   */
  pool: {
    min: 2,
    max: 10,
    acquireTimeoutMillis: 8000,
    idleTimeoutMillis: 8000,
    reapIntervalMillis: 1000
  },
  loadStrategy: LoadStrategy.SELECT_IN, // Do not change, has security implications due to its effect on filters. See https://mikro-orm.io/docs/filters#filters-and-populating-of-relationships
  forceUndefined: true
} as const satisfies Options;

function createMongoTLSConfig() {
  if (!MONGODB_CA_CERT) return;

  const rootMongoCertPath = path.join(os.tmpdir(), `mongodb-ca.pem`);
  fs.writeFileSync(rootMongoCertPath, MONGODB_CA_CERT, 'utf-8');
  return { tls: true, tlsCAFile: rootMongoCertPath };
}

const config: Options<MongoDriver> = {
  ...baseConfig,
  entities: ['./dist/**/*.entity.js'],
  entitiesTs: ['./src/**/*.entity.ts'],
  clientUrl: MONGODB_URL,
  dbName: MONGODB_DATABASE_NAME,
  driver: MongoDriver,
  driverOptions: {
    ...createMongoTLSConfig()
  },
  extensions: [Migrator, SeedManager],
  subscribers: [new LogSubscriber()],
  migrations: {
    path: './dist/migrations',
    pathTs: './migrations',
    // Need to set this, otherwise superuser is needed and our cloud database doesn't support that
    // https://github.com/mikro-orm/mikro-orm/issues/190
    disableForeignKeys: false
  },
  seeder: {
    path: './dist/seeders',
    pathTs: './seeders'
  },
  ensureIndexes: true,
  implicitTransactions: true
};

export default config;
