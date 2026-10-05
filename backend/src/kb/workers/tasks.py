from __future__ import annotations

import time
import uuid
from datetime import UTC, datetime
from typing import Any

from celery import Task, group
from sqlalchemy import update

from kb.core.models import Document
from kb.workers import runtime
from kb.workers.celery_app import app, settings


def _mark_failed(document_id: str, error: str) -> None:
    async def work() -> None:
        c = runtime.container()
        async with c.sessions() as session, session.begin():
            await session.execute(
                update(Document)
                .where(Document.id == uuid.UUID(document_id), Document.status != "deleted")
                .values(status="failed", error=error[:500], updated_at=datetime.now(UTC))
            )
        await c.events.document({"document_id": document_id, "status": "failed", "error": error[:500]})

    runtime.run(work())


@app.task(name="ingest.document", bind=True, acks_late=True, max_retries=3)
def ingest_document(self: Task[Any, Any], document_id: str, force: bool = False) -> dict[str, Any]:
    pipeline = runtime.pipeline()
    try:
        prepared = runtime.run(
            pipeline.prepare(uuid.UUID(document_id), force=force, attempt=self.request.retries + 1)
        )
    except Exception as exc:
        if self.request.retries >= (self.max_retries or 3):
            _mark_failed(document_id, f"ingest_error: {exc}")
            raise
        raise self.retry(exc=exc, countdown=2 ** (self.request.retries + 1)) from exc
    if prepared is None:
        return {"document_id": document_id, "status": "done"}
    job_id = str(prepared.job_id)
    started = time.time()
    if not prepared.batches:
        finalize.delay(job_id, document_id, started)
    else:
        group(embed_batch.s(job_id, batch, document_id, started) for batch in prepared.batches).apply_async()
    return {"document_id": document_id, "job_id": job_id, "batches": len(prepared.batches)}


@app.task(name="embed.batch", bind=True, acks_late=True, max_retries=5, rate_limit=settings.embed_rate_limit)
def embed_batch(
    self: Task[Any, Any], job_id: str, ordinals: list[int], document_id: str, started: float
) -> int:
    pipeline = runtime.pipeline()
    try:
        embedded = runtime.run(pipeline.embed_batch(uuid.UUID(job_id), ordinals))
    except Exception as exc:
        if self.request.retries >= (self.max_retries or 5):
            _mark_failed(document_id, f"embed_error: {exc}")
            raise
        raise self.retry(exc=exc, countdown=min(60, 2 ** (self.request.retries + 1))) from exc
    if runtime.run(pipeline.remaining(uuid.UUID(job_id))) == 0:
        finalize.delay(job_id, document_id, started)
    return embedded


@app.task(name="ingest.finalize", bind=True, acks_late=True, max_retries=5)
def finalize(self: Task[Any, Any], job_id: str, document_id: str, started: float) -> dict[str, Any] | None:
    try:
        return runtime.run(runtime.pipeline().finalize(uuid.UUID(job_id), (time.time() - started) * 1000))
    except Exception as exc:
        if self.request.retries >= (self.max_retries or 5):
            _mark_failed(document_id, f"finalize_error: {exc}")
            raise
        raise self.retry(exc=exc, countdown=2 ** (self.request.retries + 1)) from exc


@app.task(name="sync.source", bind=True, acks_late=True, max_retries=2)
def sync_source(self: Task[Any, Any], source_id: str) -> dict[str, Any]:
    from kb.connectors.sync import SyncService

    service = SyncService(runtime.container())
    try:
        result = runtime.run(service.sync(uuid.UUID(source_id)))
    except Exception as exc:
        raise self.retry(exc=exc, countdown=30) from exc
    for document_id in result.to_ingest:
        ingest_document.delay(str(document_id))
    return result.summary()


@app.task(name="sync.due_sources")
def sync_due_sources() -> list[str]:
    from kb.connectors.sync import due_sources

    due = runtime.run(due_sources(runtime.container()))
    for source_id in due:
        sync_source.delay(str(source_id))
    return [str(s) for s in due]


@app.task(name="eval.run", bind=True, acks_late=True, max_retries=0, time_limit=3600)
def eval_run(_self: Task[Any, Any], run_id: str) -> dict[str, Any]:
    from kb.evaluation.runner import execute_run

    return runtime.run(execute_run(runtime.container(), uuid.UUID(run_id)))


@app.task(name="maintenance.cleanup")
def cleanup() -> dict[str, int]:
    from kb.analytics.service import cleanup_stale

    return runtime.run(cleanup_stale(runtime.container()))


@app.task(name="maintenance.refresh_analytics")
def refresh_analytics() -> int:
    from kb.analytics.service import refresh_unanswered_clusters

    return runtime.run(refresh_unanswered_clusters(runtime.container()))
