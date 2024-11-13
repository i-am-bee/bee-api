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

from bullmq import Job

from workers import create_worker
from enums import ExtractionBackend
from database import database
from extraction.unstructured import unstructuredExtraction

EXTRACTION_QUEUE_NAME = "files:extraction:python"


async def processExtraction(job: Job, job_token):
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
        await unstructuredExtraction(file)
    else:
        raise RuntimeError("Unsupported backend")


extractionWorker = create_worker(EXTRACTION_QUEUE_NAME, processExtraction, {})
