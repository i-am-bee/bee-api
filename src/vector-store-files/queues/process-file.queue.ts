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

import { Job } from 'bullmq';
import { RequestContext } from '@mikro-orm/core';

import { ORM } from '@/database.js';
import { createQueue } from '@/jobs/bullmq.js';
import { processVectorStoreFile } from '@/vector-store-files/execution/process-file.js';
import { QueueName } from '@/jobs/constants.js';
import {
  VectorStoreFile,
  VectorStoreFileStatus
} from '@/vector-store-files/entities/vector-store-file.entity.js';
import { APIError } from '@/errors/error.entity.js';
import { waitForExtraction } from '@/files/utils/wait-for-extraction.js';

async function jobHandler(job: Job<{ vectorStoreFileId: string }>) {
  return RequestContext.create(ORM.em, async () => {
    const vectorStoreFile = await ORM.em.getRepository(VectorStoreFile).findOneOrFail(
      {
        id: job.data.vectorStoreFileId,
        deletedAt: null,
        status: VectorStoreFileStatus.IN_PROGRESS
      },
      { filters: { deleted: false }, populate: ['file'] }
    );
    const { failed } = await waitForExtraction(job, [vectorStoreFile.file.$]);
    if (failed.length > 0) {
      vectorStoreFile.status = VectorStoreFileStatus.FAILED;
      vectorStoreFile.lastError = APIError.from(failed[0].err);

      await ORM.em.flush();

      throw failed[0].err;
    }
    await processVectorStoreFile(vectorStoreFile);
  });
}

export const { queue } = createQueue({
  name: QueueName.VECTOR_STORES_FILE_PROCESSOR,
  jobHandler,
  jobsOptions: { attempts: 1 }
});
