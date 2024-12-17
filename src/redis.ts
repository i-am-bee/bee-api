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
import { parseURL } from 'ioredis/built/utils/index.js';

import { REDIS_CA_CERT, REDIS_CACHE_CA_CERT, REDIS_CACHE_URL, REDIS_URL } from './config.js';

export const defaultRedisConnectionOptions: RedisOptions = {
  ...parseURL(REDIS_URL),
  tls:
    REDIS_URL.startsWith('rediss') && REDIS_CA_CERT ? { ca: Buffer.from(REDIS_CA_CERT) } : undefined
};

export const defaultRedisCacheConnectionOptions: RedisOptions = {
  ...parseURL(REDIS_CACHE_URL),
  tls:
    REDIS_CACHE_URL.startsWith('rediss') && REDIS_CACHE_CA_CERT
      ? { ca: Buffer.from(REDIS_CACHE_CA_CERT) }
      : undefined,
  connectTimeout: 1000,
  maxRetriesPerRequest: 1
};

export const sharedRedisClient = new Redis(defaultRedisConnectionOptions);
export const sharedRedisCacheClient = new Redis(defaultRedisCacheConnectionOptions);

const CLIENTS: Redis[] = [sharedRedisClient, sharedRedisCacheClient];

export async function withRedisClient<R>(
  asyncCallback: (redis: Redis) => Promise<R>,
  opts?: Partial<RedisOptions>
) {
  const client = new Redis(REDIS_URL, { ...defaultRedisConnectionOptions, ...opts });
  try {
    return await asyncCallback(client);
  } finally {
    await closeClient(client);
  }
}

export function createRedisClient(opts?: Partial<RedisOptions>) {
  const client = new Redis({ ...defaultRedisConnectionOptions, ...opts });
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
