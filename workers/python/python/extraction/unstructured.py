import asyncio

from unstructured_ingest.v2.pipeline.pipeline import Pipeline
from unstructured_ingest.v2.interfaces import ProcessorConfig
from unstructured_ingest.v2.processes.partitioner import PartitionerConfig
from unstructured_ingest.v2.processes.connectors.fsspec.s3 import (
    S3IndexerConfig, S3DownloaderConfig, S3ConnectionConfig, S3AccessConfig)
from unstructured_ingest.v2.processes.connectors.fsspec.s3 import (
    S3ConnectionConfig, S3AccessConfig, S3UploaderConfig)
from unstructured_ingest.v2.processes.chunker import ChunkerConfig

from config import config
from enums import ExtractionBackend
from database import database

EXTRACTION_DIR = "unstructured"

S3_URL = f"s3://{config.s3_bucket_file_storage}"


async def unstructuredExtraction(file):
    storage_id = file["storageId"]

    s3_connection_config = S3ConnectionConfig(
        endpoint_url=config.s3_endpoint,
        access_config=S3AccessConfig(
            key=config.s3_access_key_id,
            secret=config.s3_secret_access_key
        )
    )
    pipeline = Pipeline.from_configs(
        context=ProcessorConfig(),
        indexer_config=S3IndexerConfig(remote_url=f"{S3_URL}/{storage_id}"),
        downloader_config=S3DownloaderConfig(),
        source_connection_config=s3_connection_config,
        partitioner_config=PartitionerConfig(
            partition_by_api=config.extraction_backend == ExtractionBackend.UNSTRUCTURED_API,
            partition_endpoint=config.unstructured_api_url,
            api_key=config.unstructured_api_key
        ),
        chunker_config=ChunkerConfig(
            chunk_by_api=config.extraction_backend == ExtractionBackend.UNSTRUCTURED_API,
            chunking_endpoint=config.unstructured_api_url,
            chunk_api_key=config.unstructured_api_key,
            chunking_strategy="by_title",
        ),
        destination_connection_config=s3_connection_config,
        uploader_config=S3UploaderConfig(
            remote_url=f"{S3_URL}/{EXTRACTION_DIR}")
    )
    await asyncio.to_thread(pipeline.run)

    result = database.get_collection('file').update_one(
        {"_id": file["_id"]}, {"$set": {"extraction.jobId": None, "extraction.storageId": f"{EXTRACTION_DIR}/{config.s3_bucket_file_storage}/{storage_id}.json"}})
    if result.modified_count == 0:
        raise RuntimeError("File not found")
