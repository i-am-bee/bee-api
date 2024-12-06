from opentelemetry.sdk.resources import SERVICE_NAME, Resource

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from opentelemetry.sdk._logs import LoggerProvider

from opentelemetry import trace
from opentelemetry._logs import set_logger_provider
from opentelemetry.exporter.otlp.proto.http._log_exporter import (
    OTLPLogExporter,
)
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import (
    BatchSpanProcessor,
)

from config import config

resource = Resource(attributes={
    SERVICE_NAME: "bee-api"
})

traceProvider = TracerProvider(resource=resource)
if not config.otel_sdk_disabled:
    traceProvider.add_span_processor(BatchSpanProcessor(
        OTLPSpanExporter(endpoint=config.otel_exporter_otlp_endpoint)))
    trace.set_tracer_provider(traceProvider)

logger_provider = LoggerProvider(
    resource=resource
)
if not config.otel_sdk_disabled:
    set_logger_provider(logger_provider)
    logger_provider.add_log_record_processor(
        BatchLogRecordProcessor(OTLPLogExporter(endpoint=config.otel_exporter_otlp_endpoint)))
logging_handler = LoggingHandler(logger_provider=logger_provider)
