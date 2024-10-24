import logging

from config import config

logging.basicConfig(level=logging.DEBUG if config.log_level ==
                    'trace' else config.log_level.upper())
logger = logging.getLogger('unstructured_ingest.v2')  # TODO fix this bypass
