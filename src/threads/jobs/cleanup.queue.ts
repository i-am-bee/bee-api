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
import dayjs from 'dayjs';
import { unique } from 'remeda';

import { Thread } from '../thread.entity';

import { ORM } from '@/database.js';
import { createQueue } from '@/jobs/bullmq.js';
import { QueueName } from '@/jobs/constants.js';
import { Run } from '@/runs/entities/run.entity';
import { Message } from '@/messages/message.entity';
import { RunStep } from '@/run-steps/entities/run-step.entity';
import { File } from '@/files/entities/file.entity';
import { VectorStore } from '@/vector-stores/entities/vector-store.entity';
import { getJobLogger } from '@/logger';
import { deleteVectorStoreFiles } from '@/vector-store-files/vector-store-files.service';

async function jobHandler() {
  return RequestContext.create(ORM.em, async () => {
    const runs = await ORM.em
      .getRepository(Run)
      .find(
        { createdAt: { $lt: dayjs().subtract(15, 'days').toDate() } },
        { filters: { deleted: false }, populate: ['thread'] }
      );

    const threadsWithoutRun = await ORM.em.aggregate(Thread, [
      { $match: { createdAt: { $lt: dayjs().subtract(15, 'days').toDate() } } },
      {
        $lookup: {
          from: 'run',
          localField: '_id',
          foreignField: 'thread',
          as: 'runs'
        }
      },
      { $match: { runs: { $size: 0 } } },
      { $set: { id: '$_id' } },
      { $project: { id: 1 } }
    ]);

    const threadIds = unique([
      ...threadsWithoutRun.map((t) => t.id),
      ...runs.map((r) => r.thread.id)
    ]);

    await Promise.all(
      threadIds.map(async (threadId) => {
        RequestContext.create(ORM.em, async () => {
          try {
            await ORM.em
              .getRepository(Message)
              .nativeDelete({ thread: threadId }, { filters: { deleted: false } });
            await ORM.em
              .getRepository(RunStep)
              .nativeDelete({ thread: threadId }, { filters: { deleted: false } });
            const files = await ORM.em
              .getRepository(File)
              .find({ dependsOn: threadId }, { filters: { deleted: false } });
            files.forEach((file) => file.delete()); // files will be deleted in separate job

            const vectorStores = await ORM.em
              .getRepository(VectorStore)
              .find({ dependsOn: threadId }, { filters: { deleted: false }, populate: ['files'] });
            await Promise.all(
              vectorStores.map(async (vs) => {
                await deleteVectorStoreFiles(vs.files.slice());
                ORM.em.remove(vs.files);
              })
            );
            ORM.em.remove(vectorStores);

            await ORM.em
              .getRepository(Run)
              .nativeDelete({ thread: threadId }, { filters: { deleted: false } });

            await ORM.em.flush(); // try to flush all delete before deleting the thread itself

            await ORM.em
              .getRepository(Thread)
              .nativeDelete({ id: threadId }, { filters: { deleted: false } });
          } catch (err) {
            getJobLogger('threadCleanup').warn({ err }, 'Thread can not be deleted.');
          }
        });
      })
    );
  });
}

export const { queue, worker } = createQueue({
  name: QueueName.THREADS_CLEANUP,
  jobHandler,
  jobsOptions: { attempts: 1 },
  workerOptions: {
    concurrency: 1
  }
});
