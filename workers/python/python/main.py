import asyncio
import signal

from logger import logger
from workers import run_workers, shutdown_workers
from config import config


async def main():
    # Create an event that will be triggered for shutdown
    shutdown_event = asyncio.Event()

    def signal_handler(signal, frame):
        logger.info("Signal received, shutting down.")
        shutdown_event.set()

    # Assign signal handlers to SIGTERM and SIGINT
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)

    await run_workers(config.run_bullmq_workers)
    logger.info("Workers started")

    # Wait until the shutdown event is set
    await shutdown_event.wait()
    await shutdown_workers()
    logger.info("Workers shut down successfully.")

if __name__ == "__main__":
    asyncio.run(main())
