from bullmq import Job

from workers import create_worker
from enums import ExtractionBackend
from database import database
from extraction.unstructured import unstructuredExtraction

EXTRACTION_QUEUE_NAME = "files:extraction:python"


async def processExtraction(job: Job, job_token):
    data = job.data
    file_id = data['fileId']

    file = database.get_collection('file').find_one({"_id": file_id})
    if file is None:
        raise RuntimeError("File not found")
    extraction = file["extraction"]
    backend = extraction["backend"]

    if backend == ExtractionBackend.UNSTRUCTURED_OPENSOURCE or backend == ExtractionBackend.UNSTRUCTURED_API:
        await unstructuredExtraction(file)
    else:
        raise RuntimeError("Unsupported backend")


extractionWorker = create_worker(EXTRACTION_QUEUE_NAME, processExtraction, {})
