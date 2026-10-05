from __future__ import annotations

import uuid
from collections.abc import Callable

_override: dict[str, Callable[..., None]] = {}


def set_dispatcher(name: str, fn: Callable[..., None] | None) -> None:
    if fn is None:
        _override.pop(name, None)
    else:
        _override[name] = fn


def enqueue_ingest(document_id: uuid.UUID, force: bool = False) -> None:
    if "ingest" in _override:
        _override["ingest"](document_id, force)
        return
    from kb.workers.tasks import ingest_document

    ingest_document.delay(str(document_id), force)


def enqueue_sync(source_id: uuid.UUID) -> None:
    if "sync" in _override:
        _override["sync"](source_id)
        return
    from kb.workers.tasks import sync_source

    sync_source.delay(str(source_id))


def enqueue_eval(run_id: uuid.UUID) -> None:
    if "eval" in _override:
        _override["eval"](run_id)
        return
    from kb.workers.tasks import eval_run

    eval_run.delay(str(run_id))
