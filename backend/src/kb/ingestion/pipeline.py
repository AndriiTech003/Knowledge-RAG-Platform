from __future__ import annotations

import asyncio
import time
import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from opentelemetry import trace
from sqlalchemy import func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from kb.config import Settings
from kb.core.db import rowcount
from kb.core.events import EventPublisher
from kb.core.models import Chunk, Collection, Document, IngestionJob, StagedChunk
from kb.core.storage import ObjectStorage
from kb.ingestion.chunking.chunker import chunk_document
from kb.ingestion.chunking.profiles import ChunkingProfile, get_profile
from kb.ingestion.chunking.tokenizer import TokenCounter
from kb.ingestion.hashing import document_hash, sha256_text
from kb.ingestion.parsers import ParseError, parse_document
from kb.providers.embedders.base import Embedder
from kb.retrieval.vector import vector_literal

tracer = trace.get_tracer("kb.ingestion")


@dataclass
class PrepareResult:
    job_id: uuid.UUID
    document_id: uuid.UUID
    batches: list[list[int]] = field(default_factory=list)


def now() -> datetime:
    return datetime.now(UTC)


class IngestionPipeline:
    def __init__(
        self,
        sessions: async_sessionmaker[AsyncSession],
        storage: ObjectStorage,
        embedder_for: Callable[[str], Embedder],
        counter: TokenCounter,
        events: EventPublisher,
        settings: Settings,
        profile_override: ChunkingProfile | None = None,
    ) -> None:
        self.sessions = sessions
        self.storage = storage
        self.embedder_for = embedder_for
        self.counter = counter
        self.events = events
        self.settings = settings
        self.profile_override = profile_override
        self.debug_delay_ms = 0

    async def _status(
        self, document: Document, status: str, error: str | None = None, stats: dict[str, Any] | None = None
    ) -> None:
        async with self.sessions() as session, session.begin():
            await session.execute(
                update(Document)
                .where(Document.id == document.id, Document.status != "deleted")
                .values(status=status, error=error, updated_at=now())
            )
        payload: dict[str, Any] = {
            "document_id": str(document.id),
            "collection_id": str(document.collection_id),
            "title": document.title,
            "status": status,
            "error": error,
        }
        if stats is not None:
            payload["stats"] = stats
        await self.events.document(payload)

    async def _fail_job(self, job_id: uuid.UUID, error: str) -> None:
        async with self.sessions() as session, session.begin():
            await session.execute(
                update(IngestionJob)
                .where(IngestionJob.id == job_id)
                .values(status="failed", error=error, finished_at=now())
            )

    def profile_for(self, collection: Collection) -> ChunkingProfile:
        return self.profile_override or get_profile(collection.chunking_profile)

    async def prepare(
        self, document_id: uuid.UUID, force: bool = False, attempt: int = 1
    ) -> PrepareResult | None:
        async with self.sessions() as session:
            document = await session.get(Document, document_id)
            if document is None or document.status == "deleted":
                return None
            collection = await session.get(Collection, document.collection_id)
            if collection is None:
                return None
        previous_status = document.status
        job_id = uuid.uuid4()
        async with self.sessions() as session, session.begin():
            session.add(
                IngestionJob(
                    id=job_id,
                    document_id=document.id,
                    source_id=document.source_id,
                    kind="ingest",
                    status="running",
                    attempts=attempt,
                    started_at=now(),
                )
            )
            await session.execute(
                text("delete from staged_chunks where document_id = :d and job_id <> :j"),
                {"d": document.id, "j": job_id},
            )
        await self._status(document, "parsing")
        if self.debug_delay_ms:
            await asyncio.sleep(self.debug_delay_ms / 1000)
        if not document.storage_key:
            await self._status(document, "failed", "missing_file")
            await self._fail_job(job_id, "missing_file")
            return None
        data = await self.storage.get_bytes(document.storage_key)
        filename = str(document.metadata_.get("filename") or document.external_id or document.title)
        try:
            mime, parsed = await asyncio.to_thread(parse_document, data, filename)
        except ParseError as exc:
            await self._status(document, "failed", exc.code)
            await self._fail_job(job_id, exc.code)
            return None
        profile = self.profile_for(collection)
        model = collection.embedding_model
        content_hash = sha256_text(
            f"{document_hash(parsed)}|{profile.name}:{profile.max_tokens}:{profile.contextual_prefix}|{model}"
        )
        if (
            not force
            and previous_status != "failed"
            and document.content_hash
            and content_hash == document.content_hash
        ):
            async with self.sessions() as session, session.begin():
                total = await session.scalar(
                    select(func.count()).select_from(Chunk).where(Chunk.document_id == document.id)
                )
                stats = {
                    "chunks_total": int(total or 0),
                    "chunks_new": 0,
                    "chunks_unchanged": int(total or 0),
                    "chunks_deleted": 0,
                    "skipped": True,
                }
                await session.execute(
                    update(IngestionJob)
                    .where(IngestionJob.id == job_id)
                    .values(status="done", finished_at=now(), stats=stats)
                )
            await self._status(document, "ready", stats=stats)
            return None
        await self._status(document, "chunking")
        drafts = await asyncio.to_thread(chunk_document, parsed, profile, self.counter)
        async with self.sessions() as session, session.begin():
            rows = await session.execute(
                select(Chunk.id, Chunk.content_hash).where(
                    Chunk.document_id == document.id, Chunk.embedding_model == model
                )
            )
            existing: dict[str, uuid.UUID] = {}
            for row in rows:
                existing.setdefault(row.content_hash, row.id)
            used: set[uuid.UUID] = set()
            pending: list[int] = []
            for draft in drafts:
                reused = existing.get(draft.content_hash)
                if reused is not None and reused in used:
                    reused = None
                if reused is not None:
                    used.add(reused)
                else:
                    pending.append(draft.ordinal)
                session.add(
                    StagedChunk(
                        job_id=job_id,
                        ordinal=draft.ordinal,
                        document_id=document.id,
                        text=draft.text,
                        heading_path=draft.heading_path,
                        page_start=draft.page_start,
                        page_end=draft.page_end,
                        char_start=draft.char_start,
                        char_end=draft.char_end,
                        token_count=draft.token_count,
                        content_hash=draft.content_hash,
                        embed_text=draft.embed_text,
                        reused_chunk_id=reused,
                    )
                )
            await session.execute(
                update(Document)
                .where(Document.id == document.id)
                .values(
                    title=parsed.title[:500]
                    if not document.metadata_.get("title_locked")
                    else document.title,
                    mime_type=mime,
                    page_count=parsed.page_count,
                    metadata_={**document.metadata_, **parsed.metadata, "pending_hash": content_hash},
                )
            )
            await session.execute(
                update(IngestionJob)
                .where(IngestionJob.id == job_id)
                .values(
                    stats={
                        "chunks_total": len(drafts),
                        "chunks_new": len(pending),
                        "chunks_unchanged": len(drafts) - len(pending),
                    }
                )
            )
        document.title = parsed.title if not document.metadata_.get("title_locked") else document.title
        await self._status(document, "embedding")
        size = max(1, self.settings.ingest_embed_batch)
        batches = [pending[i : i + size] for i in range(0, len(pending), size)]
        return PrepareResult(job_id=job_id, document_id=document.id, batches=batches)

    async def embed_batch(self, job_id: uuid.UUID, ordinals: list[int]) -> int:
        async with self.sessions() as session:
            rows = (
                await session.execute(
                    select(StagedChunk.ordinal, StagedChunk.embed_text, StagedChunk.document_id).where(
                        StagedChunk.job_id == job_id, StagedChunk.ordinal.in_(ordinals)
                    )
                )
            ).all()
            if not rows:
                return 0
            document = await session.get(Document, rows[0].document_id)
            if document is None:
                return 0
            collection = await session.get(Collection, document.collection_id)
            if collection is None:
                return 0
        embedder = self.embedder_for(collection.embedding_model)
        vectors = await embedder.embed_documents([r.embed_text for r in rows])
        async with self.sessions() as session, session.begin():
            for row, vector in zip(rows, vectors, strict=True):
                await session.execute(
                    text(
                        "update staged_chunks set embedding = cast(:e as vector) where job_id = :j and ordinal = :o"
                    ),
                    {"e": vector_literal(vector), "j": job_id, "o": row.ordinal},
                )
        return len(rows)

    async def remaining(self, job_id: uuid.UUID) -> int:
        async with self.sessions() as session:
            count = await session.scalar(
                text(
                    "select count(*) from staged_chunks where job_id = :j and reused_chunk_id is null "
                    "and embedding is null"
                ),
                {"j": job_id},
            )
        return int(count or 0)

    async def finalize(self, job_id: uuid.UUID, embed_ms: float = 0.0) -> dict[str, Any] | None:
        async with self.sessions() as session:
            job = await session.get(IngestionJob, job_id)
            if job is None or job.status != "running" or job.document_id is None:
                return None
            document = await session.get(Document, job.document_id)
            if document is None or document.status == "deleted":
                return None
            collection = await session.get(Collection, document.collection_id)
            if collection is None:
                return None
            latest = await session.scalar(
                select(IngestionJob.id)
                .where(IngestionJob.document_id == document.id)
                .order_by(IngestionJob.started_at.desc())
                .limit(1)
            )
            if latest != job_id:
                return None
            missing = await session.scalar(
                text(
                    "select count(*) from staged_chunks where job_id = :j and reused_chunk_id is null "
                    "and embedding is null"
                ),
                {"j": job_id},
            )
            if missing:
                raise RuntimeError(f"{missing} staged chunks are not embedded yet")
        model = collection.embedding_model
        pending_hash = str(document.metadata_.get("pending_hash") or "")
        async with self.sessions() as session, session.begin():
            claimed = await session.execute(
                text("select status from ingestion_jobs where id = :j for update"), {"j": job_id}
            )
            current = claimed.first()
            if current is None or current.status != "running":
                return None
            locked = await session.execute(
                text("select id from documents where id = :d and status <> 'deleted' for update"),
                {"d": document.id},
            )
            if locked.first() is None:
                return None
            deleted = await session.execute(
                text(
                    """
                    delete from chunks where document_id = :d and id not in (
                      select reused_chunk_id from staged_chunks where job_id = :j and reused_chunk_id is not null)
                    """
                ),
                {"d": document.id, "j": job_id},
            )
            await session.execute(
                text(
                    """
                    update chunks c set ordinal = s.ordinal, text = s.text, heading_path = s.heading_path,
                      page_start = s.page_start, page_end = s.page_end, char_start = s.char_start,
                      char_end = s.char_end, token_count = s.token_count
                    from staged_chunks s where s.job_id = :j and s.reused_chunk_id = c.id
                    """
                ),
                {"j": job_id},
            )
            inserted = await session.execute(
                text(
                    """
                    insert into chunks (id, document_id, collection_id, ordinal, text, heading_path, page_start,
                      page_end, char_start, char_end, token_count, content_hash, embedding, embedding_model)
                    select gen_random_uuid(), s.document_id, :c, s.ordinal, s.text, s.heading_path, s.page_start,
                      s.page_end, s.char_start, s.char_end, s.token_count, s.content_hash, s.embedding, :m
                    from staged_chunks s where s.job_id = :j and s.reused_chunk_id is null
                    """
                ),
                {"j": job_id, "c": collection.id, "m": model},
            )
            total = await session.scalar(
                text("select count(*) from staged_chunks where job_id = :j"), {"j": job_id}
            )
            new_count = rowcount(inserted) or 0
            stats = {
                "chunks_total": int(total or 0),
                "chunks_new": int(new_count),
                "chunks_unchanged": int(total or 0) - int(new_count),
                "chunks_deleted": int(rowcount(deleted) or 0),
                "embed_ms": round(embed_ms, 1),
            }
            metadata = {k: v for k, v in document.metadata_.items() if k != "pending_hash"}
            await session.execute(
                update(Document)
                .where(Document.id == document.id)
                .values(
                    status="ready",
                    error=None,
                    content_hash=pending_hash or document.content_hash,
                    metadata_=metadata,
                    updated_at=now(),
                )
            )
            await session.execute(text("delete from staged_chunks where job_id = :j"), {"j": job_id})
            await session.execute(
                update(IngestionJob)
                .where(IngestionJob.id == job_id)
                .values(status="done", finished_at=now(), stats=stats)
            )
        await self.events.document(
            {
                "document_id": str(document.id),
                "collection_id": str(document.collection_id),
                "title": document.title,
                "status": "ready",
                "error": None,
                "stats": stats,
            }
        )
        return stats

    async def run_inline(self, document_id: uuid.UUID, force: bool = False) -> dict[str, Any] | None:
        with tracer.start_as_current_span("ingest.prepare") as span:
            span.set_attribute("kb.document_id", str(document_id))
            prepared = await self.prepare(document_id, force=force)
        if prepared is None:
            return None
        started = time.perf_counter()
        for batch in prepared.batches:
            await self.embed_batch(prepared.job_id, batch)
        return await self.finalize(prepared.job_id, (time.perf_counter() - started) * 1000)
