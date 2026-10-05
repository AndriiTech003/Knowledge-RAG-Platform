from __future__ import annotations

from collections.abc import Callable

from httpx import AsyncClient
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from kb.core.container import Container
from tests.integration.helpers import standard_setup

EXPORTER = InMemorySpanExporter()


def provider() -> None:
    current = trace.get_tracer_provider()
    if isinstance(current, TracerProvider):
        current.add_span_processor(SimpleSpanProcessor(EXPORTER))
        return
    new = TracerProvider()
    new.add_span_processor(SimpleSpanProcessor(EXPORTER))
    trace.set_tracer_provider(new)


async def test_search_emits_retrieval_span_and_metrics(
    client: AsyncClient, clean: None, container: Container, auth: Callable[..., dict[str, str]]
) -> None:
    provider()
    await standard_setup(container)
    EXPORTER.clear()
    response = await client.post("/api/v1/search", headers=auth("carol"), json={"query": "marketing budget"})
    assert response.status_code == 200
    spans = [s for s in EXPORTER.get_finished_spans() if s.name == "rag.retrieve"]
    assert spans
    attributes = dict(spans[-1].attributes or {})
    assert attributes["rag.mode"] == "hybrid"
    assert attributes["rag.collections"] == 2
    assert "rag.timing.vector_ms" in attributes
    metrics = await client.get("/metrics")
    assert 'kb_http_requests_total{method="POST",route="/api/v1/search",status="200"}' in metrics.text
    assert "kb_celery_queue_length" in metrics.text
