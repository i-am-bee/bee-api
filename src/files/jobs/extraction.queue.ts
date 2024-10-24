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

import { ExtractionBackend } from '../extraction/constants';
import { extract } from '../extraction/extract';

import { ORM } from '@/database';
import { createQueue } from '@/jobs/bullmq';
import { QueueName } from '@/jobs/constants';
import { File } from '@/files/entities/file.entity';

async function jobHandler(job: Job<{ fileId: string; backend: ExtractionBackend }>) {
  return RequestContext.create(ORM.em, async () => {
    const file = await ORM.em.getRepository(File).findOneOrFail(
      { id: job.data.fileId },
      {
        filters: { deleted: false }
      }
    );
    await extract(file);
  });
}

export const { queue: nodeQueue } = createQueue({
  name: QueueName.FILES_EXTRACTION_NODE,
  jobHandler,
  jobsOptions: { attempts: 5 }
});

export const { queue: pythonQueue } = createQueue<
  { fileId: string; backend: ExtractionBackend },
  unknown
>({
  name: QueueName.FILES_EXTRACTION_PYTHON,
  jobsOptions: { attempts: 5 }
});
