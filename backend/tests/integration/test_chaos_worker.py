from __future__ import annotations

import asyncio
import os
import signal
import subprocess
import sys
import uuid
from collections.abc import Iterator
from pathlib import Path

import pytest
from celery import Celery
from sqlalchemy import text

from kb.config import Settings
from kb.core.container import Container
from tests.integration.helpers import add_document, create_collection

BACKEND = Path(__file__).resolve().parents[2]
DOC = "# Chaos Handbook\n\n" + "\n\n".join(
    f"## Part {i}\n\n" + " ".join(f"Statement {i}.{j} about resilient ingestion." for j in range(15))
    for i in range(6)
)


def worker_env(settings: Settings, delay_ms: int, visibility: int) -> dict[str, str]:
    env = dict(os.environ)
    env.update(
        {
            "KB_DATABASE_URL": settings.database_url,
            "KB_REDIS_URL": settings.redis_url,
            "KB_BROKER_URL": settings.broker_url,
            "KB_REDIS_PREFIX": settings.redis_prefix,
            "KB_S3_ENDPOINT": settings.s3_endpoint,
            "KB_S3_BUCKET": settings.s3_bucket,
            "KB_S3_ACCESS_KEY": settings.s3_access_key,
            "KB_S3_SECRET_KEY": settings.s3_secret_key,
            "KB_EMBEDDER": "hash",
            "KB_EMBEDDING_MODEL": "hash-384",
            "KB_TOKENIZER": "simple",
            "KB_RERANKER": "fake",
            "KB_INGEST_DEBUG_DELAY_MS": str(delay_ms),
            "KB_VISIBILITY_TIMEOUT": str(visibility),
            "OBJC_DISABLE_INITIALIZE_FORK_SAFETY": "YES",
            "HF_HUB_OFFLINE": "1",
        }
    )
    return env


def start_worker(settings: Settings, delay_ms: int, visibility: int, name: str) -> subprocess.Popen[bytes]:
    return subprocess.Popen(
        [
            sys.executable,
            "-m",
            "celery",
            "-A",
            "kb.workers.celery_app",
            "worker",
            "-Q",
            "ingest,embed",
            "-c",
            "1",
            "--loglevel=INFO",
            "-n",
            f"{name}@%h",
            "--without-mingle",
            "--without-gossip",
        ],
        cwd=BACKEND,
        env=worker_env(settings, delay_ms, visibility),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )


def producer(settings: Settings) -> Celery:
    app = Celery("chaos-producer", broker=settings.broker_url)
    app.conf.broker_transport_options = {"global_keyprefix": f"{settings.redis_prefix}:celery:"}
    return app


def children(pid: int) -> list[int]:
    out = subprocess.run(["pgrep", "-P", str(pid)], capture_output=True, text=True, check=False).stdout
    return [int(x) for x in out.split()]


def kill_tree(process: subprocess.Popen[bytes]) -> None:
    try:
        os.killpg(process.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    process.wait(timeout=10)


@pytest.fixture
def workers() -> Iterator[list[subprocess.Popen[bytes]]]:
    started: list[subprocess.Popen[bytes]] = []
    yield started
    for process in started:
        if process.poll() is None:
            kill_tree(process)


async def wait_status(container: Container, document_id: uuid.UUID, wanted: set[str], timeout: float) -> str:
    deadline = asyncio.get_running_loop().time() + timeout
    status = ""
    while asyncio.get_running_loop().time() < deadline:
        async with container.sessions() as session:
            status = str(
                await session.scalar(text("select status from documents where id = :d"), {"d": document_id})
            )
        if status in wanted:
            return status
        await asyncio.sleep(0.2)
    return status


async def chunk_count(container: Container, document_id: uuid.UUID) -> tuple[int, int]:
    async with container.sessions() as session:
        total = await session.scalar(
            text("select count(*) from chunks where document_id = :d"), {"d": document_id}
        )
        distinct = await session.scalar(
            text("select count(distinct ordinal) from chunks where document_id = :d"), {"d": document_id}
        )
    return int(total or 0), int(distinct or 0)


@pytest.mark.chaos
async def test_killing_pool_process_during_ingest_requeues_task(
    container: Container, clean: None, workers: list[subprocess.Popen[bytes]]
) -> None:
    collection = await create_collection(container, "Chaos", [("group", "engineering", "editor")])
    document_id = await add_document(container, collection, "chaos.md", DOC.encode())
    worker = start_worker(container.settings, delay_ms=4000, visibility=30, name="chaos-a")
    workers.append(worker)
    producer(container.settings).send_task(
        "ingest.document", args=[str(document_id)], queue="ingest", exchange="ingest", routing_key="ingest"
    )
    assert await wait_status(container, document_id, {"parsing"}, 60) == "parsing"
    pool = children(worker.pid)
    assert pool
    for pid in pool:
        os.kill(pid, signal.SIGKILL)
    assert await wait_status(container, document_id, {"ready", "failed"}, 90) == "ready"
    total, distinct = await chunk_count(container, document_id)
    assert total == distinct > 0
    async with container.sessions() as session:
        jobs = (
            await session.execute(
                text("select status from ingestion_jobs where document_id = :d order by started_at"),
                {"d": document_id},
            )
        ).scalars()
        statuses = list(jobs)
    assert len(statuses) >= 2
    assert statuses[-1] == "done"


@pytest.mark.chaos
async def test_killing_whole_worker_redelivers_after_visibility_timeout(
    container: Container, clean: None, workers: list[subprocess.Popen[bytes]]
) -> None:
    collection = await create_collection(container, "Chaos", [("group", "engineering", "editor")])
    document_id = await add_document(container, collection, "chaos.md", DOC.encode())
    first = start_worker(container.settings, delay_ms=5000, visibility=4, name="chaos-b1")
    workers.append(first)
    producer(container.settings).send_task(
        "ingest.document", args=[str(document_id)], queue="ingest", exchange="ingest", routing_key="ingest"
    )
    assert await wait_status(container, document_id, {"parsing"}, 60) == "parsing"
    kill_tree(first)
    await asyncio.sleep(5)
    second = start_worker(container.settings, delay_ms=0, visibility=4, name="chaos-b2")
    workers.append(second)
    assert await wait_status(container, document_id, {"ready", "failed"}, 120) == "ready"
    total, distinct = await chunk_count(container, document_id)
    assert total == distinct > 0
