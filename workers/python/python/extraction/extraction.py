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

import logging

from bullmq import Job
from opentelemetry import trace

from workers import create_worker
from enums import ExtractionBackend
from database import database

tracer = trace.get_tracer("job-trace")

logger = logging.getLogger()

EXTRACTION_QUEUE_NAME = "files-extraction-python"


async def processExtraction(job: Job, job_token):
    # TODO remove tracing once BULLMQ has instrumentation
    with tracer.start_as_current_span("job") as span:
        data = job.data
        file_id = data.get('fileId')
        if file_id is None:
            raise RuntimeError("fileId not found")

        file = await database.get_collection('file').find_one({"_id": file_id})
        if file is None:
            raise RuntimeError("File not found")
        extraction = file.get("extraction")
        if extraction is None:
            raise RuntimeError("Extraction not found")
        backend = extraction.get("backend")

        if backend == ExtractionBackend.UNSTRUCTURED_OPENSOURCE or backend == ExtractionBackend.UNSTRUCTURED_API:
            try:
                from extraction.unstructured import unstructuredExtraction
                await unstructuredExtraction(file, backend)
            except ImportError:
                logger.exception(
                    f"Unable to import unstructured, throwing away job {job.id}")
        elif backend == ExtractionBackend.DOCLING:
            try:
                from extraction.docling import docling_extraction
                await docling_extraction(file)
            except ImportError:
                logger.exception(
                    f"Unable to import docling, throwing away job {job.id}")
        else:
            raise RuntimeError("Unsupported backend")


extractionWorker = create_worker(EXTRACTION_QUEUE_NAME, processExtraction, {})
