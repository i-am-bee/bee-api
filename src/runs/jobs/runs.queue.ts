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

import { DelayedError, Job } from 'bullmq';
import { RequestContext } from '@mikro-orm/core';

import { Run, RunStatus } from '../entities/run.entity.js';
import { executeRun } from '../execution/execute.js';
import { getAllReadableRunFiles } from '../execution/tools/helpers.js';
import { toRunDto } from '../runs.service.js';

import { ORM } from '@/database.js';
import { createQueue } from '@/jobs/bullmq.js';
import { QueueName } from '@/jobs/constants.js';
import { LoadedRun } from '@/runs/execution/types.js';
import { waitForExtraction } from '@/files/utils/wait-for-extraction.js';
import { createPublisher } from '@/streaming/pubsub.js';
import { APIError, APIErrorCode } from '@/errors/error.entity.js';

const MAX_ACTIVE_RUNS_PER_USER = 5;

async function jobHandler(job: Job<{ runId: string }>) {
  return RequestContext.create(ORM.em, async () => {
    const run = (await ORM.em.getRepository(Run).findOneOrFail(
      { id: job.data.runId },
      {
        populate: [
          'thread.*',
          'assistant.*',
          'tools.tool',
          'thread.messages.attachments.file',
          'thread.toolResources.fileContainers.file',
          'thread.toolResources.vectorStoreContainers.vectorStore.files',
          'assistant.toolResources.fileContainers.file',
          'assistant.toolResources.vectorStoreContainers.vectorStore.files'
        ] as any[],
        filters: { deleted: false }
      }
    )) as LoadedRun;

    if (run.status === RunStatus.EXPIRED) return;

    const count = await ORM.em.getRepository(Run).count(
      {
        createdBy: run.createdBy,
        status: {
          $in: [RunStatus.IN_PROGRESS, RunStatus.REQUIRES_ACTION]
        }
      },
      { filters: { deleted: false } }
    );
    if (count >= MAX_ACTIVE_RUNS_PER_USER) {
      await job.moveToDelayed(Date.now() + 3000, job.token);
      throw new DelayedError();
    }

    // wait for text extraction
    const allFiles = await getAllReadableRunFiles(run);
    await waitForExtraction(job, allFiles);

    try {
      await executeRun(run);
    } catch (err) {
      // Safeguard for programmatic errors and not implemented code paths
      // Fails the run early, othewise user would wait for expiration
      run.fail(
        new APIError({ message: 'Internal server error', code: APIErrorCode.INTERNAL_SERVER_ERROR })
      );
      await ORM.em.flush();
      const publish = createPublisher(run);
      await publish({ event: 'thread.run.failed', data: toRunDto(run) });
      await publish({ event: 'done', data: '[DONE]' });
      throw err;
    }
  });
}

export const { queue } = createQueue({
  name: QueueName.RUNS,
  jobHandler,
  jobsOptions: { attempts: 1 },
  workerOptions: {
    concurrency: 100
  }
});
