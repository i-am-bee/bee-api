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

import * as http from 'node:http';

import { runWorkers } from '@/jobs/bullmq.js';
import { PORT, RUN_BULLMQ_WORKERS } from '@/config.js';
import { getLogger } from '@/logger.js';
import { createTerminus } from '@/terminus.js';

const logger = getLogger();

try {
  await runWorkers(RUN_BULLMQ_WORKERS);
  const server = http.createServer((_, res) => res.writeHead(404).end());
  createTerminus(server);
  server.listen({ port: PORT, host: '0.0.0.0' });
} catch (err) {
  logger.fatal({ err }, 'Failed to start worker!');
  process.exit(1);
}
