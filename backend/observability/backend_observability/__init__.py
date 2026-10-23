import logging
import os
import time
from dataclasses import dataclass

from fastapi import FastAPI
from fastapi.responses import Response
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http._log_exporter import OTLPLogExporter
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.instrumentation.logging import LoggingInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest

HTTP_REQUESTS = Counter(
    "http_server_requests_total",
    "Count of completed HTTP requests.",
    ("method", "status_code"),
)
HTTP_REQUEST_DURATION = Histogram(
    "http_server_request_duration_seconds",
    "Duration of completed HTTP requests.",
    ("method",),
)


@dataclass
class Observability:
    tracer_provider: TracerProvider
    logger_provider: LoggerProvider | None
    httpx_instrumentor: HTTPXClientInstrumentor

    def shutdown(self) -> None:
        self.httpx_instrumentor.uninstrument()
        self.tracer_provider.shutdown()
        if self.logger_provider is not None:
            self.logger_provider.shutdown()


def _signal_endpoint(base: str, signal_name: str) -> str:
    suffix = f"/v1/{signal_name}"
    return base.rstrip("/") if base.rstrip("/").endswith(suffix) else f"{base.rstrip('/')}{suffix}"


def instrument_app(
    app: FastAPI,
    service_name: str,
    *,
    engine=None,
) -> Observability:
    resource = Resource.create({"service.name": service_name})
    tracer_provider = TracerProvider(resource=resource)
    endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
    if endpoint:
        tracer_provider.add_span_processor(
            BatchSpanProcessor(
                OTLPSpanExporter(endpoint=_signal_endpoint(endpoint, "traces"))
            )
        )
    trace.set_tracer_provider(tracer_provider)

    httpx_instrumentor = HTTPXClientInstrumentor()
    httpx_instrumentor.instrument(tracer_provider=tracer_provider)
    FastAPIInstrumentor.instrument_app(app, tracer_provider=tracer_provider)
    if engine is not None:
        SQLAlchemyInstrumentor().instrument(
            engine=getattr(engine, "sync_engine", engine),
            tracer_provider=tracer_provider,
        )

    logger_provider = None
    if endpoint:
        logger_provider = LoggerProvider(resource=resource)
        logger_provider.add_log_record_processor(
            BatchLogRecordProcessor(
                OTLPLogExporter(endpoint=_signal_endpoint(endpoint, "logs"))
            )
        )
        logging.getLogger().addHandler(
            LoggingHandler(level=logging.INFO, logger_provider=logger_provider)
        )
        LoggingInstrumentor().instrument(tracer_provider=tracer_provider)

    @app.middleware("http")
    async def collect_http_metrics(request, call_next):
        if request.url.path == "/metrics":
            return await call_next(request)
        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            HTTP_REQUESTS.labels(request.method, "500").inc()
            HTTP_REQUEST_DURATION.labels(request.method).observe(
                time.perf_counter() - started
            )
            raise
        HTTP_REQUESTS.labels(request.method, str(response.status_code)).inc()
        HTTP_REQUEST_DURATION.labels(request.method).observe(
            time.perf_counter() - started
        )
        return response

    @app.get("/metrics", include_in_schema=False)
    def metrics() -> Response:
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

    return Observability(tracer_provider, logger_provider, httpx_instrumentor)
