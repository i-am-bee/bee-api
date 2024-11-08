import asyncio
from typing import List
from bullmq import Worker
from redis.asyncio import Redis
from redis.connection import parse_url

from logger import logger
from config import config

workers: dict[str, Worker] = dict()

redis_client = Redis(**parse_url(config.redis_url),
                     ssl_ca_data=config.redis_ca_cert, decode_responses=True)


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
