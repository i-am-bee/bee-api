from enum import StrEnum


class ExtractionBackend(StrEnum):
    UNSTRUCTURED_OPENSOURCE = 'unstructured-opensource'
    UNSTRUCTURED_API = 'unstructured-api'
    WDU = 'wdu'
