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

import { createTerminus as _createTerminus } from '@godaddy/terminus';
import fastifyPlugin from 'fastify-plugin';
import { RawServerBase } from 'fastify/types/utils.js';

import { getLogger } from './logger.js';
import { SHUTDOWN_GRACEFUL_PERIOD } from './config.js';

import { closeAllQueues, closeAllWorkers } from '@/jobs/bullmq.js';
import { closeAllClients } from '@/redis';

export function createTerminus(server: RawServerBase) {
  async function beforeShutdown() {
    getLogger().info('Server shutdown started...');

    const cleanupBullMqAndRedis = async () => {
      await closeAllWorkers();
      await closeAllQueues();
      await closeAllClients();
    };
    cleanupBullMqAndRedis();

    return new Promise((resolve) => {
      setTimeout(resolve, SHUTDOWN_GRACEFUL_PERIOD);
    });
  }

  async function onShutdown() {
    getLogger().info('Server has successfully shut down');
  }

  _createTerminus(server, {
    signals: ['SIGTERM', 'SIGINT'],
    healthChecks: {
      '/healthcheck': () => Promise.resolve()
    },
    useExit0: true,
    beforeShutdown,
    onShutdown,
    sendFailuresDuringShutdown: false,
    logger: (msg, error) => {
      getLogger().error({ error }, msg);
    }
  });
}

export const terminusPlugin = fastifyPlugin(async (app) => createTerminus(app.server));
