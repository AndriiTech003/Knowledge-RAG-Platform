from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import mimetypes
import sys
import time
import uuid
from pathlib import Path
from typing import Any

from sqlalchemy import select, text

from kb.config import Settings, get_settings
from kb.core.container import Container, build_container
from kb.core.dbadmin import create_database, drop_database, migrate
from kb.core.models import Collection, CollectionGrant, Document
from kb.evaluation.dataset import default_data_dir
from kb.ingestion.chunking.profiles import ChunkingProfile
from kb.ingestion.parsers import detect_mime
from kb.ingestion.pipeline import IngestionPipeline
from kb.retrieval.vector import ensure_vector_index

SEED_OWNER = "seed"


def log(message: str) -> None:
    sys.stdout.write(message + "\n")
    sys.stdout.flush()


async def ensure_collections(
    container: Container, data_dir: Path, model: str | None = None
) -> dict[str, uuid.UUID]:
    specs: list[dict[str, Any]] = json.loads((data_dir / "collections.json").read_text())
    ids: dict[str, uuid.UUID] = {}
    embedding_model = model or container.settings.embedding_model
    async with container.sessions() as session, session.begin():
        await ensure_vector_index(session, embedding_model)
        for spec in specs:
            existing = await session.scalar(select(Collection).where(Collection.name == spec["name"]))
            if existing is None:
                existing = Collection(
                    id=uuid.uuid4(),
                    name=spec["name"],
                    description=spec.get("description"),
                    embedding_model=embedding_model,
                    chunking_profile=spec.get("chunking_profile", "default"),
                    created_by=SEED_OWNER,
                )
                session.add(existing)
                await session.flush()
            await session.execute(
                text("delete from collection_grants where collection_id = :c"), {"c": existing.id}
            )
            for grant in spec["grants"]:
                session.add(
                    CollectionGrant(
                        collection_id=existing.id,
                        principal_type=grant["principal_type"],
                        principal_id=grant["principal_id"],
                        role=grant["role"],
                    )
                )
            ids[spec["slug"]] = existing.id
    await container.access.bump_version()
    return ids


async def register_corpus(
    container: Container, data_dir: Path, collections: dict[str, uuid.UUID]
) -> list[uuid.UUID]:
    corpus = data_dir / "corpus"
    queued: list[uuid.UUID] = []
    for path in sorted(p for p in corpus.rglob("*") if p.is_file()):
        relative = path.relative_to(corpus).as_posix()
        slug = relative.split("/", 1)[0]
        if slug not in collections:
            continue
        collection_id = collections[slug]
        data = path.read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        mime = detect_mime(data, path.name)
        key = f"collections/{collection_id}/uploads/seed/{path.name}"
        external_id = f"upload:{path.name}"
        async with container.sessions() as session, session.begin():
            existing = await session.scalar(
                select(Document).where(
                    Document.collection_id == collection_id, Document.external_id == external_id
                )
            )
            if (
                existing is not None
                and existing.metadata_.get("raw_sha256") == digest
                and existing.status == "ready"
            ):
                continue
            await container.storage.put_bytes(key, data, mimetypes.guess_type(path.name)[0] or mime)
            metadata = {
                "filename": path.name,
                "corpus_path": relative,
                "raw_sha256": digest,
                "size": len(data),
                "uploaded_by": SEED_OWNER,
            }
            if existing is None:
                existing = Document(
                    id=uuid.uuid4(),
                    collection_id=collection_id,
                    external_id=external_id,
                    title=path.name,
                    mime_type=mime,
                    storage_key=key,
                    content_hash="",
                    status="queued",
                    metadata_=metadata,
                )
                session.add(existing)
            else:
                existing.storage_key = key
                existing.status = "queued"
                existing.metadata_ = {**existing.metadata_, **metadata}
            await session.flush()
            queued.append(existing.id)
    return queued


async def ingest_inline(
    container: Container,
    documents: list[uuid.UUID],
    profile: ChunkingProfile | None = None,
    concurrency: int = 4,
) -> dict[str, int]:
    pipeline = IngestionPipeline(
        container.sessions,
        container.storage,
        container.embedder_for,
        container.token_counter(),
        container.events,
        container.settings,
        profile,
    )
    semaphore = asyncio.Semaphore(concurrency)
    totals = {"documents": 0, "chunks": 0, "failed": 0}

    async def one(document_id: uuid.UUID) -> None:
        async with semaphore:
            stats = await pipeline.run_inline(document_id, force=profile is not None)
            totals["documents"] += 1
            if stats:
                totals["chunks"] += int(stats.get("chunks_total", 0))

    await asyncio.gather(*(one(d) for d in documents))
    async with container.sessions() as session:
        failed = await session.scalar(text("select count(*) from documents where status = 'failed'"))
    totals["failed"] = int(failed or 0)
    return totals


async def wait_ready(container: Container, timeout: float) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        async with container.sessions() as session:
            pending = await session.scalar(
                text(
                    "select count(*) from documents where status in ('queued','parsing','chunking','embedding')"
                )
            )
        if not pending:
            return True
        await asyncio.sleep(1)
    return False


async def seed(settings: Settings, data_dir: Path, mode: str, wait: float) -> dict[str, Any]:
    container = build_container(settings)
    try:
        await container.storage.ensure_bucket()
        collections = await ensure_collections(container, data_dir)
        queued = await register_corpus(container, data_dir, collections)
        log(f"seed: {len(collections)} collections, {len(queued)} documents to ingest ({mode})")
        result: dict[str, Any] = {"collections": len(collections), "queued": len(queued)}
        if mode == "inline":
            result.update(await ingest_inline(container, queued))
        elif mode == "celery":
            from kb.documents.dispatch import enqueue_ingest

            for document_id in queued:
                enqueue_ingest(document_id)
            if wait:
                result["ready"] = await wait_ready(container, wait)
        async with container.sessions() as session:
            counts = (
                await session.execute(
                    text(
                        "select count(*) filter (where status='ready') as ready, count(*) as total from documents"
                    )
                )
            ).one()
            chunks = await session.scalar(text("select count(*) from chunks"))
        result.update(
            {"ready_documents": int(counts.ready), "documents": int(counts.total), "chunks": int(chunks or 0)}
        )
        return result
    finally:
        await container.aclose()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="kb-seed")
    parser.add_argument("--reset", action="store_true", help="drop and recreate the database first")
    parser.add_argument("--mode", choices=["inline", "celery", "none"], default="inline")
    parser.add_argument("--wait", type=float, default=600.0)
    parser.add_argument("--data-dir", type=Path, default=default_data_dir())
    parser.add_argument("--migrate-only", action="store_true")
    args = parser.parse_args(argv)
    settings = get_settings()
    if args.reset:
        drop_database(settings.database_url)
    create_database(settings.database_url)
    migrate(settings.database_url)
    if args.migrate_only:
        log("seed: database migrated")
        return 0
    result = asyncio.run(seed(settings, args.data_dir, args.mode, args.wait))
    log(json.dumps(result))
    return 0 if result.get("ready", True) is not False else 1


if __name__ == "__main__":
    raise SystemExit(main())
