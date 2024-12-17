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

import { Loaded } from '@mikro-orm/core';
import { DelayedError, Job } from 'bullmq';

import { File } from '../entities/file.entity.js';

import { nodeQueue, pythonQueue } from '@/files/jobs/extraction.queue.js';

export async function waitForExtraction(
  job: Job,
  files: Loaded<File, 'extraction'>[]
): Promise<{ ready: File[]; failed: { file: File; err: any }[] }> {
  const ready = [],
    failed = [];
  for (const file of files) {
    try {
      if (!file.extraction) throw new Error('Extraction not found');
      if (file.extraction.jobId) {
        const extractionJob =
          (await nodeQueue.getJob(file.extraction.jobId)) ??
          (await pythonQueue.getJob(file.extraction.jobId));
        if (!extractionJob) throw new Error('Extraction job not found');

        const state = await extractionJob.getState();

        if (state == 'failed') {
          throw new Error('Extraction job failed, unable to proceed');
        }
        // Extraction (or posprocessing) hasn't completed yet
        if (state !== 'completed') {
          await job.moveToDelayed(Date.now() + 3000, job.token);
          throw new DelayedError();
        }
        ready.push(file);
      }
    } catch (err) {
      if (err instanceof DelayedError) throw err;
      failed.push({ file, err });
    }
  }

  return { ready, failed };
}
