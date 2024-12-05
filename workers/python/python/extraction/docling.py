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

import asyncio
import tempfile
import json
import aioboto3

from docling.document_converter import DocumentConverter
from docling_core.transforms.chunker import HierarchicalChunker

from config import config
from database import database

EXTRACTION_DIR = "docling"

S3_URL = f"s3://{config.s3_bucket_file_storage}"


async def docling_extraction(file):
    storage_id = file["storageId"]
    file_name = file["filename"]

    session = aioboto3.Session()
    async with session.resource("s3",
                                endpoint_url=config.s3_endpoint,
                                aws_access_key_id=config.s3_access_key_id,
                                aws_secret_access_key=config.s3_secret_access_key,
                                aws_session_token=None,
                                ) as s3:
        with tempfile.TemporaryDirectory() as tmp_dir:
            # Use file_name to support file type discrimination.
            source_doc = f"{tmp_dir}/{file_name}"

            await s3.meta.client.download_file(config.s3_bucket_file_storage, storage_id, source_doc)

            converter = DocumentConverter()
            result = await asyncio.to_thread(converter.convert, source_doc, max_num_pages=100, max_file_size=20971520)
            doc = result.document
            dict = doc.export_to_dict()
            markdown = doc.export_to_markdown()
            chunks = [{"text": c.text}
                      for c in list(HierarchicalChunker().chunk(doc))]

            document_storage_id = f"{EXTRACTION_DIR}/{storage_id}/document.json"
            await s3.meta.client.put_object(
                Bucket=f"{config.s3_bucket_file_storage}",
                Key=document_storage_id,
                Body=json.dumps(dict),
                ContentType="application/json"
            )
            text_storage_id = f"{EXTRACTION_DIR}/{storage_id}/text.md"
            await s3.meta.client.put_object(
                Bucket=f"{config.s3_bucket_file_storage}",
                Key=text_storage_id,
                Body=markdown,
                ContentType="text/markdown"
            )
            chunks_storage_id = f"{EXTRACTION_DIR}/{storage_id}/chunks.json"
            await s3.meta.client.put_object(
                Bucket=f"{config.s3_bucket_file_storage}",
                Key=chunks_storage_id,
                Body=json.dumps(chunks),
                ContentType="application/json"
            )

    result = await database.get_collection('file').update_one(
        {"_id": file["_id"]}, {"$set": {
            "extraction.jobId": None,
            "extraction.documentStorageId": document_storage_id,
            "extraction.chunksStorageId": chunks_storage_id,
            "extraction.textStorageId": text_storage_id
        }})

    if result.modified_count == 0:
        raise RuntimeError("File not found")
