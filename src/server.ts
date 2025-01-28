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

import '@/ui/auth-server.js';

import { JsonSchemaToTsProvider } from '@fastify/type-provider-json-schema-to-ts';
import { fastify } from 'fastify';

import { PORT, BEE_OBSERVE_API_URL, RUN_BULLMQ_WORKERS } from './config.js';
import { databasePlugin } from './database.js';
import { errorPlugin } from './errors/plugin.js';
import { threadsModule } from './threads/threads.module.js';
import { fastifyLogger, getCorrelationId, LogLabels } from './logger.js';
import { swaggerPlugin } from './swagger.js';
import { assistantsModule } from './assistants/assistants.module.js';
import { authPlugin } from './auth/authentication.js';
import { usersModule } from './users/users.module.js';
import { messagesModule } from './messages/messages.module.js';
import { requestContextPlugin } from './context.js';
import { runsModule } from './runs/runs.module.js';
import { toolsModule } from './tools/tools.module.js';
import { runWorkers } from './jobs/bullmq.js';
import { rateLimitPlugin } from './rate-limit.js';
import { runStepsModule } from './run-steps/run-steps.module.js';
import { vectorStoresModule } from './vector-stores/vector-stores.module.js';
import { vectorStoreFilesModule } from './vector-store-files/vector-store-files.module.js';
import { uiModule } from './ui/ui.module.js';
import { terminusPlugin } from './terminus.js';
import { filesModule } from './files/files.module.js';
import { ajv } from './ajv.js';
import { multipartPlugin } from './multipart.js';
import { metricsPlugin } from './metrics.js';
import { observeModule } from './observe/observe.module.js';
import { createCronJobs } from './jobs/jobs.js';
import { projectsModule } from './administration/projects.module.js';
import { projectUsersModule } from './administration/project-users.module.js';
import { organizationUsersModule } from './administration/organization-users.module.js';
import { apiKeysModule } from './administration/api-keys.module.js';
import { artifactsModule } from './artifacts/artifacts.module.js';
import { chatModule } from './chat/chat.module.js';
import { embeddingsModule } from './embeddings/embeddings.module.js';

const app = fastify({
  logger: fastifyLogger,
  requestIdHeader: false,
  genReqId: getCorrelationId,
  requestIdLogLabel: LogLabels.CORRELATION_ID,
  pluginTimeout: 60_000,
  ajv
}).withTypeProvider<JsonSchemaToTsProvider>();

app.setSerializerCompiler(() => (data) => JSON.stringify(data));

process.on('unhandledRejection', (reason, p) => {
  app.log.fatal({ err: reason, promise: p }, 'Unhandled promise rejection');
  process.exit(1);
});

try {
  // Plugins
  app.register(requestContextPlugin);
  app.register(terminusPlugin);
  app.register(errorPlugin);
  app.register(databasePlugin);
  app.register(authPlugin);
  app.register(swaggerPlugin);
  app.register(multipartPlugin);
  app.register(metricsPlugin);
  await app.register(rateLimitPlugin);

  // Top-level modules
  app.register(usersModule, { prefix: '/v1' });
  app.register(assistantsModule, { prefix: '/v1' });
  app.register(threadsModule, { prefix: '/v1' });
  app.register(messagesModule, { prefix: '/v1' });
  app.register(runsModule, { prefix: '/v1' });
  app.register(toolsModule, { prefix: '/v1' });
  app.register(runStepsModule, { prefix: '/v1' });
  app.register(filesModule, { prefix: '/v1' });
  app.register(vectorStoresModule, { prefix: '/v1' });
  app.register(vectorStoreFilesModule, { prefix: '/v1' });
  app.register(apiKeysModule, { prefix: '/v1' });
  app.register(projectsModule, { prefix: '/v1' });
  app.register(projectUsersModule, { prefix: '/v1' });
  app.register(organizationUsersModule, { prefix: '/v1' });
  app.register(artifactsModule, { prefix: '/v1' });
  app.register(chatModule, { prefix: '/v1' });
  app.register(embeddingsModule, { prefix: '/v1' });

  app.register(uiModule, { prefix: '/v1' });

  // bee observe proxy
  if (BEE_OBSERVE_API_URL) {
    app.register(observeModule, { prefix: '/observe/v1' });
  }

  await createCronJobs();

  // Bullmq workers
  await runWorkers(RUN_BULLMQ_WORKERS);

  await app.listen({ port: PORT, host: '0.0.0.0' });
} catch (err) {
  app.log.fatal({ err }, 'Failed to start server!');
  process.exit(1);
}
