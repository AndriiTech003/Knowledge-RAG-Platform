from __future__ import annotations

import asyncio
import json
import uuid
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import APIRouter, Query, Request, Response, status
from fastapi.responses import StreamingResponse

from kb.core.events import document_channel
from kb.core.pagination import Page
from kb.deps import AccessDep, ContainerDep, PrincipalDep, SessionDep
from kb.documents.dispatch import enqueue_ingest
from kb.documents.schemas import (
    ChunkDetail,
    ChunkOut,
    DocumentDetail,
    DocumentOut,
    DocumentRegister,
    DownloadUrl,
    UploadUrlRequest,
    UploadUrlResponse,
)
from kb.documents.service import DocumentService

router = APIRouter(tags=["documents"])
SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"}


def sse(event: str, data: object) -> bytes:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n".encode()


@router.post(
    "/collections/{collection_id}/documents/upload-url",
    response_model=UploadUrlResponse,
    operation_id="createUploadUrl",
)
async def upload_url(
    collection_id: uuid.UUID,
    body: UploadUrlRequest,
    principal: PrincipalDep,
    session: SessionDep,
    access: AccessDep,
    container: ContainerDep,
) -> UploadUrlResponse:
    service = DocumentService(session, access, container.storage, container.settings)
    return await service.upload_url(principal, collection_id, body)


@router.post(
    "/collections/{collection_id}/documents",
    response_model=DocumentOut,
    status_code=status.HTTP_201_CREATED,
    operation_id="registerDocument",
)
async def register_document(
    collection_id: uuid.UUID,
    body: DocumentRegister,
    principal: PrincipalDep,
    session: SessionDep,
    access: AccessDep,
    container: ContainerDep,
    response: Response,
) -> DocumentOut:
    service = DocumentService(session, access, container.storage, container.settings)
    document, created = await service.register(principal, collection_id, body)
    if not created:
        response.status_code = status.HTTP_200_OK
    enqueue_ingest(document.id)
    await container.events.document(
        {
            "document_id": str(document.id),
            "collection_id": str(collection_id),
            "title": document.title,
            "status": "queued",
            "error": None,
        }
    )
    return document


@router.get(
    "/collections/{collection_id}/documents", response_model=Page[DocumentOut], operation_id="listDocuments"
)
async def list_documents(
    collection_id: uuid.UUID,
    principal: PrincipalDep,
    session: SessionDep,
    access: AccessDep,
    container: ContainerDep,
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    mime: str | None = None,
    q: str | None = None,
    cursor: str | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> Page[DocumentOut]:
    service = DocumentService(session, access, container.storage, container.settings)
    return await service.list_documents(principal, collection_id, status_filter, mime, q, cursor, limit)


@router.get("/documents/events", operation_id="documentEvents", response_class=StreamingResponse)
async def document_events(
    request: Request, principal: PrincipalDep, container: ContainerDep
) -> StreamingResponse:
    allowed = {str(cid) for cid in await container.access.allowed_collections(principal)}

    async def stream() -> AsyncIterator[bytes]:
        pubsub = container.redis.pubsub()
        await pubsub.subscribe(document_channel(container.settings))
        try:
            yield sse("ready", {"collections": sorted(allowed)})
            idle = 0.0
            while True:
                if await request.is_disconnected():
                    break
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if message is None:
                    idle += 1.0
                    if idle >= 15:
                        idle = 0.0
                        yield b": ping\n\n"
                    continue
                idle = 0.0
                try:
                    payload = json.loads(message["data"])
                except (TypeError, ValueError):
                    continue
                collection = payload.get("collection_id")
                if collection is None:
                    document_id = payload.get("document_id")
                    if not document_id:
                        continue
                    async with container.sessions() as session:
                        from kb.core.models import Document

                        doc = await session.get(Document, uuid.UUID(document_id))
                        collection = str(doc.collection_id) if doc else None
                    payload["collection_id"] = collection
                if collection in allowed:
                    yield sse("status", payload)
        except asyncio.CancelledError:
            raise
        finally:
            await pubsub.unsubscribe()
            await pubsub.close()

    return StreamingResponse(stream(), media_type="text/event-stream", headers=SSE_HEADERS)


@router.get("/documents/{document_id}", response_model=DocumentDetail, operation_id="getDocument")
async def get_document(
    document_id: uuid.UUID,
    principal: PrincipalDep,
    session: SessionDep,
    access: AccessDep,
    container: ContainerDep,
) -> DocumentDetail:
    return await DocumentService(session, access, container.storage, container.settings).detail(
        principal, document_id
    )


@router.get(
    "/documents/{document_id}/download-url", response_model=DownloadUrl, operation_id="getDownloadUrl"
)
async def download_url(
    document_id: uuid.UUID,
    principal: PrincipalDep,
    session: SessionDep,
    access: AccessDep,
    container: ContainerDep,
) -> DownloadUrl:
    service = DocumentService(session, access, container.storage, container.settings)
    return await service.download_url(principal, document_id)


@router.get(
    "/documents/{document_id}/chunks", response_model=Page[ChunkOut], operation_id="listDocumentChunks"
)
async def document_chunks(
    document_id: uuid.UUID,
    principal: PrincipalDep,
    session: SessionDep,
    access: AccessDep,
    container: ContainerDep,
    cursor: str | None = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> Page[ChunkOut]:
    service = DocumentService(session, access, container.storage, container.settings)
    return await service.chunks(principal, document_id, cursor, limit)


@router.post(
    "/documents/{document_id}/reindex",
    response_model=DocumentOut,
    status_code=status.HTTP_202_ACCEPTED,
    operation_id="reindexDocument",
)
async def reindex_document(
    document_id: uuid.UUID,
    principal: PrincipalDep,
    session: SessionDep,
    access: AccessDep,
    container: ContainerDep,
) -> DocumentOut:
    service = DocumentService(session, access, container.storage, container.settings)
    document = await service.mark_for_reindex(principal, document_id)
    enqueue_ingest(document_id, force=True)
    return document


@router.delete(
    "/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT, operation_id="deleteDocument"
)
async def delete_document(
    document_id: uuid.UUID,
    principal: PrincipalDep,
    session: SessionDep,
    access: AccessDep,
    container: ContainerDep,
) -> Response:
    service = DocumentService(session, access, container.storage, container.settings)
    key = await service.delete(principal, document_id)
    if key:
        await container.storage.delete(key)
    await container.events.document({"document_id": str(document_id), "status": "deleted", "error": None})
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/chunks/{chunk_id}", response_model=ChunkDetail, operation_id="getChunk")
async def get_chunk(
    chunk_id: uuid.UUID,
    principal: PrincipalDep,
    session: SessionDep,
    access: AccessDep,
    container: ContainerDep,
) -> ChunkDetail:
    return await DocumentService(session, access, container.storage, container.settings).chunk(
        principal, chunk_id
    )
