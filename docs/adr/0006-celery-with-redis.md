# ADR 0006: Celery + Redis for background work

Status: accepted · 2026-10-02

## Context

Ingestion, embedding, web/Notion sync and eval runs are slow and must survive restarts.

## Decision

Celery with Redis as broker and result backend, queues `ingest`, `embed`, `sync`, `eval`, `maintenance`, Celery Beat for schedules. `acks_late`, `task_reject_on_worker_lost`, prefetch 1, retries with exponential backoff; tasks are idempotent thanks to content hashes.

## Alternatives considered

arq / Dramatiq / RQ: lighter and (arq) async-native, but less common in job listings and weaker routing/beat story.

## Consequences

- Celery is not async-native: each worker process keeps one event loop and reuses the async pipeline code (`kb.workers.runtime`).
- No chord: a Redis-backend chord callback was observed being delivered several times (stale kombu bindings), so the last embed batch to finish enqueues `ingest.finalize`, and finalize claims the job row `FOR UPDATE` — duplicate deliveries are harmless.
- Chaos tests kill the pool process and the whole worker mid-ingest; the task is redelivered and the document ends `ready` with no duplicate chunks.
- On macOS billiard defaulted to `spawn`, which breaks Celery's fast trace; the app forces `fork` on Darwin.
