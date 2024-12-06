# Copyright 2024 IBM Corp.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from config import config
import logging
import asyncio
from typing import List
from bullmq import Worker
from redis.asyncio import Redis
from redis.asyncio.retry import Retry
from redis.exceptions import (TimeoutError, ConnectionError)
from redis.backoff import ExponentialBackoff
from opentelemetry.instrumentation.redis import RedisInstrumentor

logger = logging.getLogger()


workers: dict[str, Worker] = dict()

redis_options = {
    "decode_responses": True,
    "health_check_interval": 10,
    "retry": Retry(ExponentialBackoff(cap=10, base=1), 5),
    "retry_on_error": [ConnectionError, TimeoutError, ConnectionResetError]
}

RedisInstrumentor().instrument()

redis_client = Redis.from_url(
    config.redis_url, **redis_options) if config.redis_ca_cert is None else Redis.from_url(
    config.redis_url, ssl_ca_data=config.redis_ca_cert, **redis_options)


def create_worker(queue_name: str, processor, opts):
    worker = Worker(queue_name, processor, {
                    **opts, "autorun": False, "connection": redis_client})

    def completedCallback(job, result):
        logger.info("Job done")
    worker.on('completed', completedCallback)

    def failedCallback(job, err):
        logger.error("Job Failed", err)
    worker.on('failed', failedCallback)

    def errorCallback(err, job):
        logger.info("Worker failed", err)
    worker.on('error', errorCallback)

    workers[queue_name] = worker
    return worker


Runners = list[tuple[Worker, asyncio.Task]]


async def run_workers(names: List[str]):
    # TODO add autodiscovery
    import extraction.extraction

    tuples: Runners = []
    for name in names:
        worker = workers.get(name)
        if worker is not None:
            task = asyncio.create_task(worker.run())
            tuples.append((worker, task))
    return tuples


async def shutdown_workers(runners: Runners):
    for (worker, task) in runners:
        await worker.close()
        await task
