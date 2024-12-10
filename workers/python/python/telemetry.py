from opentelemetry import trace
from opentelemetry._logs import set_logger_provider
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.exporter.otlp.proto.http._log_exporter import OTLPLogExporter
from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor

from config import config

resource = Resource.create(attributes={
    SERVICE_NAME: "bee-api"
})

traceProvider = TracerProvider(resource=resource)
logger_provider = LoggerProvider(
    resource=resource
)
logging_handler = LoggingHandler(logger_provider=logger_provider)


def setup_telemetry():
    if config.otel_sdk_disabled:
        return

    traceProvider.add_span_processor(BatchSpanProcessor(
        OTLPSpanExporter()))
    trace.set_tracer_provider(traceProvider)

    set_logger_provider(logger_provider)
    logger_provider.add_log_record_processor(
        BatchLogRecordProcessor(OTLPLogExporter()))
