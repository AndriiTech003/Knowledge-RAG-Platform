from __future__ import annotations

import re
import uuid
from datetime import UTC, datetime
from typing import Literal

from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from kb.access.service import AccessService
from kb.auth.principal import Principal
from kb.config import Settings
from kb.core.errors import ProblemError, bad_request, not_found
from kb.core.models import Chunk, Document, IngestionJob
from kb.core.pagination import Page, decode_cursor, encode_cursor
from kb.core.storage import ObjectStorage
from kb.documents.schemas import (
    ChunkDetail,
    ChunkOut,
    ChunkStats,
    DocumentDetail,
    DocumentOut,
    DocumentRegister,
    DownloadUrl,
    IngestionJobOut,
    UploadUrlRequest,
    UploadUrlResponse,
)
from kb.ingestion.parsers import ParseError, check_allowed, detect_mime

ALLOWED_EXTENSIONS = (".pdf", ".docx", ".md", ".markdown", ".html", ".htm", ".txt")
SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9._-]+")


def safe_filename(name: str) -> str:
    base = name.replace("\\", "/").rsplit("/", 1)[-1]
    cleaned = SAFE_NAME_RE.sub("-", base).strip("-.")
    return cleaned[:150] or "file"


def document_out(d: Document) -> DocumentOut:
    return DocumentOut(
        id=d.id,
        collection_id=d.collection_id,
        source_id=d.source_id,
        external_id=d.external_id,
        title=d.title,
        mime_type=d.mime_type,
        status=d.status,
        error=d.error,
        page_count=d.page_count,
        metadata=d.metadata_,
        created_at=d.created_at,
        updated_at=d.updated_at,
    )


def chunk_out(c: Chunk) -> ChunkOut:
    return ChunkOut(
        id=c.id,
        document_id=c.document_id,
        ordinal=c.ordinal,
        text=c.text,
        heading_path=list(c.heading_path or []),
        page_start=c.page_start,
        page_end=c.page_end,
        char_start=c.char_start,
        char_end=c.char_end,
        token_count=c.token_count,
        content_hash=c.content_hash,
        embedding_model=c.embedding_model,
    )


class DocumentService:
    def __init__(
        self, session: AsyncSession, access: AccessService, storage: ObjectStorage, settings: Settings
    ) -> None:
        self.session = session
        self.access = access
        self.storage = storage
        self.settings = settings

    async def _document(
        self, principal: Principal, document_id: uuid.UUID, action: Literal["read", "write"]
    ) -> tuple[Document, str]:
        document = await self.session.get(Document, document_id)
        if document is None or document.status == "deleted":
            raise not_found("Document")
        try:
            role = await self.access.require(principal, document.collection_id, action)
        except ProblemError as exc:
            if exc.status == 404:
                raise not_found("Document") from exc
            raise
        return document, role

    async def upload_url(
        self, principal: Principal, collection_id: uuid.UUID, body: UploadUrlRequest
    ) -> UploadUrlResponse:
        await self.access.require(principal, collection_id, "write")
        if body.size > self.settings.max_upload_bytes:
            raise ProblemError(
                413,
                "FILE_TOO_LARGE",
                "File too large",
                f"Maximum size is {self.settings.max_upload_bytes} bytes",
            )
        if not body.filename.lower().endswith(ALLOWED_EXTENSIONS):
            raise ProblemError(
                415, "UNSUPPORTED_TYPE", "Unsupported file type", "Allowed: PDF, DOCX, Markdown, HTML, TXT"
            )
        key = f"collections/{collection_id}/uploads/{uuid.uuid4()}/{safe_filename(body.filename)}"
        url = await self.storage.presign_put(key)
        return UploadUrlResponse(
            upload_url=url, storage_key=key, expires_in=self.settings.presign_ttl_seconds
        )

    async def register(
        self, principal: Principal, collection_id: uuid.UUID, body: DocumentRegister
    ) -> tuple[DocumentOut, bool]:
        await self.access.require(principal, collection_id, "write")
        prefix = f"collections/{collection_id}/uploads/"
        if not body.storage_key.startswith(prefix) or ".." in body.storage_key:
            raise bad_request("INVALID_STORAGE_KEY", "Storage key does not belong to this collection")
        size = await self.storage.stat_size(body.storage_key)
        if size is None:
            raise bad_request("UPLOAD_NOT_FOUND", "The file was not uploaded")
        if size > self.settings.max_upload_bytes:
            await self.storage.delete(body.storage_key)
            raise ProblemError(413, "FILE_TOO_LARGE", "File too large")
        data = await self.storage.get_bytes(body.storage_key)
        mime = detect_mime(data, body.filename)
        try:
            check_allowed(mime)
        except ParseError as exc:
            await self.storage.delete(body.storage_key)
            raise ProblemError(415, "UNSUPPORTED_TYPE", "Unsupported file type", str(exc)) from exc
        external_id = f"upload:{safe_filename(body.filename)}"
        existing = await self.session.scalar(
            select(Document).where(
                Document.collection_id == collection_id, Document.external_id == external_id
            )
        )
        old_key: str | None = None
        created = existing is None
        metadata = {"filename": body.filename, "size": size, "uploaded_by": principal.sub}
        if body.title:
            metadata["title_locked"] = True
        if existing is None:
            document = Document(
                id=uuid.uuid4(),
                collection_id=collection_id,
                external_id=external_id,
                title=body.title or body.filename,
                mime_type=mime,
                storage_key=body.storage_key,
                content_hash="",
                status="queued",
                metadata_=metadata,
            )
            self.session.add(document)
        else:
            document = existing
            old_key = document.storage_key if document.storage_key != body.storage_key else None
            document.storage_key = body.storage_key
            document.mime_type = mime
            document.status = "queued"
            document.error = None
            document.metadata_ = {**document.metadata_, **metadata}
            if body.title:
                document.title = body.title
            document.updated_at = datetime.now(UTC)
        await self.session.commit()
        await self.session.refresh(document)
        if old_key:
            await self.storage.delete(old_key)
        return document_out(document), created

    async def list_documents(
        self,
        principal: Principal,
        collection_id: uuid.UUID,
        status: str | None,
        mime: str | None,
        q: str | None,
        cursor: str | None,
        limit: int,
    ) -> Page[DocumentOut]:
        await self.access.require(principal, collection_id, "read")
        query = select(Document).where(Document.collection_id == collection_id, Document.status != "deleted")
        if status:
            query = query.where(Document.status == status)
        if mime:
            query = query.where(Document.mime_type == mime)
        if q:
            pattern = f"%{q.replace('%', '').replace('_', '')}%"
            query = query.where(or_(Document.title.ilike(pattern), Document.external_id.ilike(pattern)))
        decoded = decode_cursor(cursor)
        if decoded:
            ts = datetime.fromisoformat(str(decoded["created_at"]))
            did = uuid.UUID(str(decoded["id"]))
            query = query.where(
                or_(Document.created_at < ts, (Document.created_at == ts) & (Document.id < did))
            )
        query = query.order_by(Document.created_at.desc(), Document.id.desc()).limit(limit + 1)
        rows = list((await self.session.scalars(query)).all())
        next_cursor = None
        if len(rows) > limit:
            last = rows[limit - 1]
            next_cursor = encode_cursor({"created_at": last.created_at, "id": str(last.id)})
        return Page[DocumentOut](items=[document_out(d) for d in rows[:limit]], next_cursor=next_cursor)

    async def detail(self, principal: Principal, document_id: uuid.UUID) -> DocumentDetail:
        document, role = await self._document(principal, document_id, "read")
        stats = (
            await self.session.execute(
                select(
                    func.count(), func.coalesce(func.sum(Chunk.token_count), 0), func.count(Chunk.embedding)
                ).where(Chunk.document_id == document_id)
            )
        ).one()
        jobs = (
            await self.session.scalars(
                select(IngestionJob)
                .where(IngestionJob.document_id == document_id)
                .order_by(IngestionJob.started_at.desc())
                .limit(20)
            )
        ).all()
        base = document_out(document).model_dump()
        return DocumentDetail(
            **base,
            chunk_stats=ChunkStats(chunks=int(stats[0]), tokens=int(stats[1]), embedded=int(stats[2])),
            jobs=[
                IngestionJobOut(
                    id=j.id,
                    kind=j.kind,
                    status=j.status,
                    attempts=j.attempts,
                    error=j.error,
                    started_at=j.started_at,
                    finished_at=j.finished_at,
                    stats=j.stats,
                )
                for j in jobs
            ],
            role=role,
        )

    async def download_url(self, principal: Principal, document_id: uuid.UUID) -> DownloadUrl:
        document, _ = await self._document(principal, document_id, "read")
        if not document.storage_key:
            raise not_found("Document file")
        filename = str(document.metadata_.get("filename") or document.title)
        url = await self.storage.presign_get(document.storage_key, filename)
        return DownloadUrl(
            url=url,
            expires_in=self.settings.presign_ttl_seconds,
            mime_type=document.mime_type,
            filename=filename,
        )

    async def chunks(
        self, principal: Principal, document_id: uuid.UUID, cursor: str | None, limit: int
    ) -> Page[ChunkOut]:
        await self._document(principal, document_id, "read")
        decoded = decode_cursor(cursor)
        query = select(Chunk).where(Chunk.document_id == document_id)
        if decoded:
            query = query.where(Chunk.ordinal > int(decoded["ordinal"]))
        rows = list((await self.session.scalars(query.order_by(Chunk.ordinal).limit(limit + 1))).all())
        next_cursor = encode_cursor({"ordinal": rows[limit - 1].ordinal}) if len(rows) > limit else None
        return Page[ChunkOut](items=[chunk_out(c) for c in rows[:limit]], next_cursor=next_cursor)

    async def chunk(self, principal: Principal, chunk_id: uuid.UUID) -> ChunkDetail:
        row = (
            await self.session.execute(
                select(Chunk, Document)
                .join(Document, Document.id == Chunk.document_id)
                .where(Chunk.id == chunk_id)
            )
        ).first()
        if row is None:
            raise not_found("Chunk")
        chunk, document = row[0], row[1]
        if await self.access.role_for(principal, chunk.collection_id) is None or document.status == "deleted":
            raise not_found("Chunk")
        return ChunkDetail(
            **chunk_out(chunk).model_dump(),
            collection_id=chunk.collection_id,
            document_title=document.title,
            mime_type=document.mime_type,
        )

    async def mark_for_reindex(self, principal: Principal, document_id: uuid.UUID) -> DocumentOut:
        document, _ = await self._document(principal, document_id, "write")
        document.status = "queued"
        document.error = None
        await self.session.commit()
        await self.session.refresh(document)
        return document_out(document)

    async def delete(self, principal: Principal, document_id: uuid.UUID) -> str | None:
        document, _ = await self._document(principal, document_id, "write")
        key = document.storage_key
        await self.session.execute(delete(Chunk).where(Chunk.document_id == document_id))
        document.status = "deleted"
        document.storage_key = None
        document.external_id = f"deleted:{document.id}:{document.external_id}"
        await self.session.commit()
        return key
