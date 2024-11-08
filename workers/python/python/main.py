import asyncio
import signal
from aiohttp import web
from bullmq import Worker

from logger import logger
from workers import run_workers, shutdown_workers
from config import config


async def create_shudown_event():
    shutdown_event = asyncio.Event()

    def signal_handler(signal, frame):
        logger.info("Signal received, shutting down.")
        shutdown_event.set()

    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)

    return shutdown_event


async def create_workers():
    runners = await run_workers(config.run_bullmq_workers)
    logger.info("Workers started")

    async def stop_workers():
        await shutdown_workers(runners)
        logger.info("Workers shut down successfully.")
    return ([worker for worker, _ in runners], stop_workers)


async def create_web_app(workers: list[Worker]):
    async def healthcheck(request):
        healthy = True
        for worker in workers:
            if not worker.running:
                healthy = False
        if healthy:
            return web.Response(status=200)
        else:
            return web.Response(status=503)

    app = web.Application()
    app.add_routes([web.get('/health', healthcheck)])
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, '0.0.0.0', 8080)
    await site.start()
    logger.info("HTTP server started")

    async def stop_web_app():
        await runner.cleanup()
        logger.info("HTTP server shut down successfully.")
    return stop_web_app


async def main():
    shutdown_event = await create_shudown_event()
    workers, stop_workers = await create_workers()
    stop_web_app = await create_web_app(workers)

    await shutdown_event.wait()

    await stop_workers()
    await stop_web_app()

if __name__ == "__main__":
    asyncio.run(main())
