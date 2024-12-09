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
import path from 'node:path';

import { Utils } from '@mikro-orm/core';
import { globby } from 'globby';
import { DefaultJobOptions, Job, Queue, Worker, WorkerOptions } from 'bullmq';
import { isTruthy } from 'remeda';

import { defaultRedisConnectionOptions } from '../redis.js';
import { getLogger } from '../logger.js';
import { gateway } from '../metrics.js';

import { QueueName } from './constants.js';

import { jobLocalStorage } from '@/context.js';

const getQueueLogger = (queueName: string, job?: Job) =>
  getLogger().child({
    queueName: queueName,
    job: job && {
      id: job.id,
      name: job.name,
      repeatJobKey: job.repeatJobKey,
      failedReason: job.failedReason,
      data: job.data
    }
  });

const logger = getLogger();

const connectionOpts = {
  ...defaultRedisConnectionOptions,
  // https://docs.bullmq.io/guide/going-to-production#maxretriesperrequest
  maxRetriesPerRequest: null
};

const defaultJobOptions = {
  removeOnComplete: true,
  removeOnFail: true,
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000
  }
};

function addCallbacks(worker: Worker, queue: Queue) {
  worker.on('active', (job) => {
    getQueueLogger(queue.name, job).info('Job started');
  });

  worker.on('error', (err) => {
    getQueueLogger(queue.name).warn({ err }, `Worker failed`);
  });

  worker.on('failed', async (job, err) => {
    getQueueLogger(queue.name, job).error({ err }, `Job failed`);
  });

  worker.on('completed', async (job) => {
    getQueueLogger(queue.name, job).info(`Job done`);
    try {
      await gateway?.push({ jobName: queue.name });
    } catch (err) {
      getQueueLogger(queue.name, job).warn({ err }, 'Failed to push metrics');
    }
  });
}

const Workers = new Map<QueueName, Worker>();

interface CreateQueueInput<T, U> {
  name: QueueName;
  jobsOptions?: DefaultJobOptions;
  workerOptions?: Partial<Omit<WorkerOptions, 'autorun'>>;
  jobHandler?: (job: Job<T>) => Promise<U>;
}

const Queues = new Map<QueueName, Queue>();

export function createQueue<T, U>({
  name,
  jobsOptions,
  workerOptions,
  jobHandler
}: CreateQueueInput<T, U>) {
  const queue = new Queue<T, U>(name, {
    connection: connectionOpts,
    defaultJobOptions: jobsOptions ? { ...defaultJobOptions, ...jobsOptions } : defaultJobOptions
  });

  queue.on('error', (err) => {
    getQueueLogger(name).error({ err }, `Queue has failed`);
  });

  if (jobHandler) {
    const worker = new Worker(
      name,
      (job) => jobLocalStorage.run({ job }, () => jobHandler(job)),

      {
        // We need to set autorun to false otherwise the worker might pick up stuff while ORM is not ready
        autorun: false,
        ...workerOptions,
        connection: connectionOpts
      }
    );
    addCallbacks(worker, queue);
    Workers.set(name, worker);
  }
  Queues.set(name, queue);

  return { queue };
}

export async function runWorkers(queueNames: QueueName[]) {
  await discoverQueues();

  const workers = queueNames.map((name) => Workers.get(name)).filter(isTruthy);

  workers.forEach((worker) => worker.run());

  logger.info({ queueNames }, `Workers started successfully`);
}

export async function closeAllQueues() {
  await Promise.all(
    [...Queues.values()].map(async (queue) => {
      if (!(await queue.isPaused())) {
        await queue.close();
      }
    })
  );
  logger.info('Queues shutdown successfully');
}

export async function closeAllWorkers() {
  await Promise.all(
    [...Workers.values()].map(async (worker) => {
      if (!worker.isPaused()) {
        await worker.close();
      }
    })
  );
  logger.info('Workers shutdown successfully');
}

export async function discoverQueues() {
  const isTsNode = Utils.detectTsNode();
  const queueGlobs = isTsNode ? './**/*.queue.ts' : './**/*.queue.js';
  const cwd = isTsNode ? `${process.cwd()}/src` : `${process.cwd()}/dist`;
  const queues = await globby(queueGlobs, { cwd });
  logger.info({ queues }, `Discovered queues.`);
  await Promise.all(queues.map((file) => import(path.join(cwd, file))));
}
