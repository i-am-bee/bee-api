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

import { FastifyReply } from 'fastify';
import { Loaded } from '@mikro-orm/core';
import { Redis } from 'ioredis';

import { Event } from './dtos/event.js';
import * as sse from './sse.js';

import { withRedisClient } from '@/redis.js';
import { Run } from '@/runs/entities/run.entity.js';
import { getLogger } from '@/logger.js';

function createChannel(run: Loaded<Run>) {
  return `run:${run.id}`;
}

function createPublisherFn(client: Redis, run: Loaded<Run>) {
  return async function publish(event: Event) {
    return client.publish(createChannel(run), JSON.stringify(event));
  };
}

export type Publisher = ReturnType<typeof createPublisherFn>;

export async function withPublisher<R>(
  run: Loaded<Run>,
  asyncCallback: (publish: ReturnType<typeof createPublisherFn>) => Promise<R>
) {
  return await withRedisClient((client) => {
    return asyncCallback(createPublisherFn(client, run));
  });
}

export async function subscribeAndForward(
  run: Loaded<Run>,
  res: FastifyReply,
  {
    signal,
    onReady,
    onFailed
  }: {
    signal: AbortSignal;
    onReady: () => Promise<void>;
    onFailed: () => Promise<void>;
  }
) {
  return withRedisClient(async (client: Redis) => {
    const channel = createChannel(run);
    sse.init(res);
    try {
      await new Promise<void>((resolve, reject) => {
        client.subscribe(channel, (err) => {
          if (err) {
            getLogger().error({ err, channel }, 'Subscription failed');
            onFailed().catch(reject);
            reject(err);
          } else {
            getLogger().trace({ channel }, 'Subscribed');
            onReady().catch(reject);
          }
        });
        client.on('message', (_, message) => {
          const event = JSON.parse(message) as Event;
          sse.send(res, event);
          if (event.event === 'done' || event.event === 'error') {
            resolve();
          }
        });
        signal.addEventListener('abort', () => {
          reject(signal.reason);
        });
      });
    } catch (err) {
      sse.send(res, { event: 'error', data: err });
    } finally {
      sse.end(res);
    }
  });
}
