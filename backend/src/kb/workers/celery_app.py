from __future__ import annotations

import os
import sys
from typing import Any

import billiard
from celery import Celery
from celery.schedules import crontab
from celery.signals import worker_process_init, worker_process_shutdown
from kombu import Exchange, Queue

from kb.config import get_settings

settings = get_settings()

if sys.platform == "darwin":
    billiard.set_start_method("fork", force=True)

QUEUES = ("ingest", "embed", "sync", "eval", "maintenance")

app = Celery("kb", broker=settings.broker_url, backend=settings.redis_url, include=["kb.workers.tasks"])

app.conf.update(
    task_queues=[Queue(name, Exchange(name, type="direct"), routing_key=name) for name in QUEUES],
    task_default_queue="ingest",
    task_default_exchange="ingest",
    task_default_routing_key="ingest",
    task_routes={f"{name}.*": {"queue": name, "exchange": name, "routing_key": name} for name in QUEUES},
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_acks_on_failure_or_timeout=True,
    worker_prefetch_multiplier=1,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    result_expires=3600,
    broker_transport_options={
        "visibility_timeout": int(os.environ.get("KB_VISIBILITY_TIMEOUT", "600")),
        "global_keyprefix": f"{settings.redis_prefix}:celery:",
    },
    result_backend_transport_options={"global_keyprefix": f"{settings.redis_prefix}:celery:"},
    broker_connection_retry_on_startup=True,
    worker_hijack_root_logger=False,
    beat_schedule={
        "sync-due-sources": {"task": "sync.due_sources", "schedule": 60.0},
        "cleanup-staged": {"task": "maintenance.cleanup", "schedule": crontab(minute=17)},
        "refresh-analytics": {"task": "maintenance.refresh_analytics", "schedule": 300.0},
    },
    timezone="UTC",
)


@worker_process_init.connect
def _init_worker(**_: Any) -> None:
    from kb.core.telemetry import setup_worker_telemetry
    from kb.workers import runtime

    runtime.loop()
    delay = int(os.environ.get("KB_INGEST_DEBUG_DELAY_MS", "0"))
    runtime.set_debug_delay(delay)
    setup_worker_telemetry(get_settings())


@worker_process_shutdown.connect
def _shutdown_worker(**_: Any) -> None:
    from kb.workers import runtime

    runtime.reset()
