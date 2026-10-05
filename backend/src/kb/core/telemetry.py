from __future__ import annotations

import time
from collections.abc import Awaitable, Callable, Iterable

import redis as redis_sync
from fastapi import FastAPI, Request, Response
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest
from prometheus_client.core import REGISTRY, GaugeMetricFamily
from prometheus_client.registry import Collector

from kb.config import Settings

HTTP_REQUESTS = Counter("kb_http_requests_total", "HTTP requests", ["method", "route", "status"])
HTTP_LATENCY = Histogram(
    "kb_http_request_duration_seconds",
    "HTTP latency",
    ["method", "route"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30),
)
CHAT_REQUESTS = Counter("kb_chat_requests_total", "Chat questions by outcome", ["outcome"])
RAG_STEP = Histogram(
    "kb_rag_step_duration_seconds",
    "Duration of RAG pipeline steps",
    ["step"],
    buckets=(0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30),
)
LLM_TOKENS = Counter("kb_llm_tokens_total", "LLM tokens", ["model", "direction"])
LLM_COST = Counter("kb_llm_cost_usd_total", "LLM cost in USD", ["model"])
FEEDBACK = Counter("kb_feedback_total", "Feedback by rating", ["rating"])
INFLIGHT_STREAMS = Gauge("kb_chat_streams_inflight", "Chat SSE streams in flight")


class CeleryQueueCollector(Collector):
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.client = redis_sync.Redis.from_url(settings.broker_url, socket_timeout=0.5)

    def collect(self) -> Iterable[GaugeMetricFamily]:
        family = GaugeMetricFamily(
            "kb_celery_queue_length", "Messages waiting in Celery queues", labels=["queue"]
        )
        prefix = f"{self.settings.redis_prefix}:celery:"
        for queue in ("ingest", "embed", "sync", "eval", "maintenance"):
            try:
                raw = self.client.llen(prefix + queue)
                length = raw if isinstance(raw, int) else 0
            except redis_sync.RedisError:
                continue
            family.add_metric([queue], length)
        yield family


_collector: dict[str, CeleryQueueCollector] = {}


def install_metrics(app: FastAPI, settings: Settings) -> None:
    if "queues" not in _collector:
        collector = CeleryQueueCollector(settings)
        REGISTRY.register(collector)
        _collector["queues"] = collector

    @app.middleware("http")
    async def metrics_middleware(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        started = time.perf_counter()
        response = await call_next(request)
        route = request.scope.get("route")
        path = str(getattr(route, "path", "unmatched"))
        if request.url.path.startswith("/api/v1") and not path.startswith("/api/v1") and path != "unmatched":
            path = "/api/v1" + path
        HTTP_REQUESTS.labels(request.method, path, str(response.status_code)).inc()
        HTTP_LATENCY.labels(request.method, path).observe(time.perf_counter() - started)
        return response

    @app.get("/metrics", include_in_schema=False)
    async def metrics() -> Response:
        return Response(generate_latest(REGISTRY), media_type=CONTENT_TYPE_LATEST)


def setup_tracing(app: FastAPI, settings: Settings, engine_sync: object | None = None) -> None:
    if not settings.otel_enabled:
        return
    from opentelemetry import trace
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
    from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter, SpanExporter

    provider = TracerProvider(resource=Resource.create({"service.name": settings.service_name}))
    exporter: SpanExporter = (
        OTLPSpanExporter(endpoint=settings.otel_endpoint) if settings.otel_endpoint else ConsoleSpanExporter()
    )
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
    FastAPIInstrumentor.instrument_app(app, excluded_urls="/metrics,/health/live,/health/ready")
    if engine_sync is not None:
        SQLAlchemyInstrumentor().instrument(engine=engine_sync)


def setup_worker_telemetry(settings: Settings) -> None:
    if not settings.otel_enabled:
        return
    from opentelemetry import trace
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    from opentelemetry.instrumentation.celery import CeleryInstrumentor
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter, SpanExporter

    provider = TracerProvider(resource=Resource.create({"service.name": "kb-worker"}))
    exporter: SpanExporter = (
        OTLPSpanExporter(endpoint=settings.otel_endpoint) if settings.otel_endpoint else ConsoleSpanExporter()
    )
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
    CeleryInstrumentor().instrument()


def tracer_span(name: str) -> object:
    from opentelemetry import trace

    return trace.get_tracer("kb").start_as_current_span(name)
