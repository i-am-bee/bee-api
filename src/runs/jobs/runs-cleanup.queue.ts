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

import { RequestContext } from '@mikro-orm/core';

import { Run, RunStatus } from '../entities/run.entity.js';

import { ORM } from '@/database.js';
import { createQueue } from '@/jobs/bullmq.js';
import { QueueName } from '@/jobs/constants.js';

async function jobHandler() {
  return RequestContext.create(ORM.em, async () => {
    await ORM.em.getRepository(Run).nativeUpdate(
      {
        expiresAt: { $lt: new Date() }
      },
      { status: RunStatus.EXPIRED }
    );
  });
}

export const { queue } = createQueue({
  name: QueueName.RUNS_CLEANUP,
  jobHandler,
  jobsOptions: { attempts: 1 },
  workerOptions: { concurrency: 1 }
});
