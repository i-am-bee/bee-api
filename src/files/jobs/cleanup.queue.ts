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

import { File } from '../entities/file.entity.js';
import { s3Client } from '../files.service.js';

import { ORM } from '@/database.js';
import { createQueue } from '@/jobs/bullmq.js';
import { QueueName } from '@/jobs/constants.js';
import { S3_BUCKET_FILE_STORAGE } from '@/config.js';
import { getJobLogger } from '@/logger.js';
import { deleteVectorStoreFiles } from '@/vector-store-files/vector-store-files.service.js';
import { VectorStoreFile } from '@/vector-store-files/entities/vector-store-file.entity.js';
import { Thread } from '@/threads/thread.entity.js';

async function jobHandler(_: Job) {
  let files: File[] = [];
  await RequestContext.create(ORM.em, async () => {
    files = await ORM.em.getRepository(File).find(
      { bytes: { $gt: 0 }, deletedAt: { $exists: true } },
      {
        filters: { deleted: false }
      }
    );
  });

  await Promise.all(
    files.map(async (fileObj) => {
      return RequestContext.create(ORM.em, async () => {
        const file = await ORM.em.getRepository(File).findOneOrFail(
          { id: fileObj.id },
          {
            filters: { deleted: false }
          }
        );
        try {
          if (file.storageId !== '') {
            await s3Client
              .deleteObject({ Bucket: S3_BUCKET_FILE_STORAGE, Key: file.storageId })
              .promise();
            file.storageId = '';
          }

          if (file.extraction) {
            if (file.extraction?.storageId && file.extraction.storageId !== file.storageId) {
              await s3Client
                .deleteObject({ Bucket: S3_BUCKET_FILE_STORAGE, Key: file.extraction.storageId })
                .promise();
            }
            file.extraction = undefined;
          }

          const vectoreStoreFiles = await ORM.em.getRepository(VectorStoreFile).find({ file });
          if (vectoreStoreFiles.length > 0) await deleteVectorStoreFiles(vectoreStoreFiles);

          if (file.dependsOn) {
            // hard delete the file when depends on the deleted thread
            const thread = await ORM.em
              .getRepository(Thread)
              .findOne({ id: file.dependsOn.id }, { filters: { deleted: false } });
            if (!thread) {
              ORM.em.remove(file);
            }
          }

          file.bytes = 0;
          await ORM.em.flush();
        } catch (err) {
          getJobLogger('filesCleanup').warn({ err }, 'File can not be deleted.');
        }
      });
    })
  );
}

export const { queue, worker } = createQueue({
  name: QueueName.FILES_CLEANUP,
  jobHandler,
  jobsOptions: { attempts: 1 },
  workerOptions: {
    concurrency: 1
  }
});
