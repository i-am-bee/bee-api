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

import { Redis, RedisOptions } from 'ioredis';

import { REDIS_CA_CERT, REDIS_CACHE_CA_CERT, REDIS_CACHE_URL, REDIS_URL } from './config.js';
const CLIENTS: Redis[] = [];

export function createClient(opts?: Partial<RedisOptions>): Redis {
  const client = new Redis(REDIS_URL, {
    tls:
      REDIS_URL.startsWith('rediss') && REDIS_CA_CERT
        ? {
            ca: Buffer.from(REDIS_CA_CERT)
          }
        : undefined,
    ...opts
  });
  CLIENTS.push(client);
  return client;
}

export function createCacheClient(opts?: Partial<RedisOptions>): Redis {
  const client = new Redis(REDIS_CACHE_URL, {
    tls:
      REDIS_URL.startsWith('rediss') && REDIS_CACHE_CA_CERT
        ? {
            ca: Buffer.from(REDIS_CACHE_CA_CERT)
          }
        : undefined,
    ...opts
  });
  CLIENTS.push(client);
  return client;
}

export async function closeClient(client: Redis) {
  if (client.status !== 'end') {
    await new Promise<void>((resolve) => {
      client.quit(() => resolve());
    });
  }
}

export async function closeAllClients() {
  await Promise.all(CLIENTS.map((client) => closeClient(client)));
}
