from __future__ import annotations

import hashlib
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from croniter import croniter
from sqlalchemy import delete, select, update
from sqlalchemy.dialects.postgresql import insert

from kb.connectors.base import Connector, PageState
from kb.connectors.notion import NotionConnector
from kb.connectors.upload import UploadConnector
from kb.connectors.web_crawler import WebCrawler
from kb.core.container import Container
from kb.core.models import Chunk, Document, IngestionJob, Source, WebPageState


@dataclass
class SyncResult:
    source_id: uuid.UUID
    to_ingest: list[uuid.UUID] = field(default_factory=list)
    stats: dict[str, Any] = field(default_factory=dict)

    def summary(self) -> dict[str, Any]:
        return {"source_id": str(self.source_id), **self.stats}


def connector_for(kind: str, container: Container) -> Connector:
    settings = container.settings
    if kind == "web":
        return WebCrawler(
            requests_per_second=settings.web_requests_per_second, user_agent=settings.web_user_agent
        )
    if kind == "notion":
        return NotionConnector(settings.notion_token, settings.notion_api_url)
    return UploadConnector()


class SyncService:
    def __init__(self, container: Container, connector: Connector | None = None) -> None:
        self.container = container
        self.connector = connector

    async def sync(self, source_id: uuid.UUID) -> SyncResult:
        c = self.container
        result = SyncResult(source_id=source_id)
        async with c.sessions() as session:
            source = await session.get(Source, source_id)
            if source is None:
                return result
            rows = await session.scalars(select(WebPageState).where(WebPageState.source_id == source_id))
            state = {r.url: PageState(r.url, r.etag, r.last_modified, r.last_status) for r in rows}
        job_id = uuid.uuid4()
        started = datetime.now(UTC)
        async with c.sessions() as session, session.begin():
            session.add(
                IngestionJob(
                    id=job_id,
                    source_id=source_id,
                    kind="sync",
                    status="running",
                    attempts=1,
                    started_at=started,
                )
            )
            await session.execute(update(Source).where(Source.id == source_id).values(status="syncing"))
        connector = self.connector or connector_for(source.kind, c)
        plan = await connector.fetch(source_id, source.config, state)
        created = updated = unchanged = deleted = 0
        for fetched in plan.upserts:
            digest = hashlib.sha256(fetched.content).hexdigest()
            key = f"collections/{source.collection_id}/sources/{source_id}/{hashlib.sha256(fetched.external_id.encode()).hexdigest()[:32]}"
            async with c.sessions() as session, session.begin():
                existing = await session.scalar(
                    select(Document).where(
                        Document.collection_id == source.collection_id,
                        Document.external_id == fetched.external_id,
                    )
                )
                if (
                    existing is not None
                    and existing.metadata_.get("raw_sha256") == digest
                    and existing.status in {"ready", "queued", "parsing", "chunking", "embedding"}
                ):
                    unchanged += 1
                    continue
                await c.storage.put_bytes(key, fetched.content, fetched.mime_type)
                metadata = {**fetched.metadata, "raw_sha256": digest, "filename": fetched.filename}
                if existing is None:
                    document = Document(
                        id=uuid.uuid4(),
                        collection_id=source.collection_id,
                        source_id=source_id,
                        external_id=fetched.external_id,
                        title=fetched.title[:500],
                        mime_type=fetched.mime_type,
                        storage_key=key,
                        content_hash="",
                        status="queued",
                        metadata_=metadata,
                    )
                    session.add(document)
                    created += 1
                else:
                    document = existing
                    document.storage_key = key
                    document.status = "queued"
                    document.error = None
                    document.metadata_ = {**existing.metadata_, **metadata}
                    updated += 1
                await session.flush()
                result.to_ingest.append(document.id)
        unchanged += len(plan.unchanged)
        for external_id in plan.deletions:
            async with c.sessions() as session, session.begin():
                gone = await session.scalar(
                    select(Document).where(
                        Document.collection_id == source.collection_id,
                        Document.external_id == external_id,
                        Document.status != "deleted",
                    )
                )
                if gone is None:
                    continue
                await session.execute(delete(Chunk).where(Chunk.document_id == gone.id))
                gone.status = "deleted"
                deleted += 1
            await c.events.document(
                {
                    "document_id": str(gone.id),
                    "collection_id": str(source.collection_id),
                    "status": "deleted",
                    "error": None,
                    "title": gone.title,
                }
            )
        now = datetime.now(UTC)
        async with c.sessions() as session, session.begin():
            for page in plan.states:
                stmt = insert(WebPageState).values(
                    source_id=source_id,
                    url=page.url,
                    etag=page.etag,
                    last_modified=page.last_modified,
                    last_status=page.last_status,
                    fetched_at=now,
                )
                await session.execute(
                    stmt.on_conflict_do_update(
                        index_elements=["source_id", "url"],
                        set_={
                            "etag": stmt.excluded.etag,
                            "last_modified": stmt.excluded.last_modified,
                            "last_status": stmt.excluded.last_status,
                            "fetched_at": stmt.excluded.fetched_at,
                        },
                    )
                )
            stats = {
                "fetched": len(plan.upserts),
                "created": created,
                "updated": updated,
                "unchanged": unchanged,
                "deleted": deleted,
                "errors": len(plan.errors),
            }
            result.stats = stats
            failed = bool(plan.errors) and not plan.upserts and not plan.unchanged
            await session.execute(
                update(Source)
                .where(Source.id == source_id)
                .values(
                    last_synced_at=now,
                    status="failed" if failed else "ok",
                    last_error="; ".join(plan.errors)[:2000] or None,
                )
            )
            await session.execute(
                update(IngestionJob)
                .where(IngestionJob.id == job_id)
                .values(
                    status="failed" if failed else "done",
                    finished_at=now,
                    stats=stats,
                    error="; ".join(plan.errors)[:2000] or None,
                )
            )
        return result


def is_due(schedule: str | None, last: datetime | None, now: datetime) -> bool:
    if not schedule:
        return False
    if not croniter.is_valid(schedule):
        return False
    if last is None:
        return True
    upcoming = croniter(schedule, last).get_next(datetime)
    return bool(upcoming <= now)


async def due_sources(container: Container) -> list[uuid.UUID]:
    now = datetime.now(UTC)
    async with container.sessions() as session:
        rows = (
            await session.execute(
                select(Source.id, Source.schedule, Source.last_synced_at, Source.status).where(
                    Source.schedule.is_not(None), Source.kind != "upload"
                )
            )
        ).all()
    return [r.id for r in rows if r.status != "syncing" and is_due(r.schedule, r.last_synced_at, now)]
