from __future__ import annotations

import uuid

from fastapi import APIRouter, Response, status
from sqlalchemy import func, select

from kb.connectors.schemas import NotionConfig, SourceCreate, SourceOut, SourcePatch, SyncJobOut, WebConfig
from kb.core.errors import not_found
from kb.core.models import Document, IngestionJob, Source
from kb.deps import AccessDep, PrincipalDep, SessionDep
from kb.documents.dispatch import enqueue_sync

router = APIRouter(tags=["sources"])


async def _out(session: SessionDep, source: Source) -> SourceOut:
    count = await session.scalar(
        select(func.count())
        .select_from(Document)
        .where(Document.source_id == source.id, Document.status != "deleted")
    )
    return SourceOut(
        id=source.id,
        collection_id=source.collection_id,
        kind=source.kind,
        config=source.config,
        schedule=source.schedule,
        last_synced_at=source.last_synced_at,
        status=source.status,
        last_error=source.last_error,
        document_count=int(count or 0),
    )


@router.get(
    "/collections/{collection_id}/sources", response_model=list[SourceOut], operation_id="listSources"
)
async def list_sources(
    collection_id: uuid.UUID, principal: PrincipalDep, session: SessionDep, access: AccessDep
) -> list[SourceOut]:
    await access.require(principal, collection_id, "read")
    rows = await session.scalars(
        select(Source)
        .where(Source.collection_id == collection_id, Source.kind != "upload")
        .order_by(Source.id)
    )
    return [await _out(session, s) for s in rows.all()]


@router.post(
    "/collections/{collection_id}/sources",
    response_model=SourceOut,
    status_code=status.HTTP_201_CREATED,
    operation_id="createSource",
)
async def create_source(
    collection_id: uuid.UUID,
    body: SourceCreate,
    principal: PrincipalDep,
    session: SessionDep,
    access: AccessDep,
) -> SourceOut:
    await access.require(principal, collection_id, "manage")
    source = Source(
        id=uuid.uuid4(),
        collection_id=collection_id,
        kind=body.kind,
        config=body.config,
        schedule=body.schedule,
        status="idle",
    )
    session.add(source)
    await session.commit()
    return await _out(session, source)


async def _source(session: SessionDep, collection_id: uuid.UUID, source_id: uuid.UUID) -> Source:
    source = await session.get(Source, source_id)
    if source is None or source.collection_id != collection_id:
        raise not_found("Source")
    return source


@router.patch(
    "/collections/{collection_id}/sources/{source_id}", response_model=SourceOut, operation_id="updateSource"
)
async def patch_source(
    collection_id: uuid.UUID,
    source_id: uuid.UUID,
    body: SourcePatch,
    principal: PrincipalDep,
    session: SessionDep,
    access: AccessDep,
) -> SourceOut:
    await access.require(principal, collection_id, "manage")
    source = await _source(session, collection_id, source_id)
    if body.config is not None:
        model = WebConfig if source.kind == "web" else NotionConfig
        source.config = model.model_validate(body.config).model_dump()
    if "schedule" in body.model_fields_set:
        source.schedule = body.schedule or None
    await session.commit()
    return await _out(session, source)


@router.delete(
    "/collections/{collection_id}/sources/{source_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="deleteSource",
)
async def delete_source(
    collection_id: uuid.UUID,
    source_id: uuid.UUID,
    principal: PrincipalDep,
    session: SessionDep,
    access: AccessDep,
) -> Response:
    await access.require(principal, collection_id, "manage")
    source = await _source(session, collection_id, source_id)
    await session.delete(source)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/sources/{source_id}/sync",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=SourceOut,
    operation_id="syncSource",
)
async def sync_source(
    source_id: uuid.UUID, principal: PrincipalDep, session: SessionDep, access: AccessDep
) -> SourceOut:
    source = await session.get(Source, source_id)
    if source is None or await access.role_for(principal, source.collection_id) is None:
        raise not_found("Source")
    await access.require(principal, source.collection_id, "write")
    source.status = "queued"
    await session.commit()
    enqueue_sync(source_id)
    return await _out(session, source)


@router.get("/sources/{source_id}/jobs", response_model=list[SyncJobOut], operation_id="listSourceJobs")
async def source_jobs(
    source_id: uuid.UUID, principal: PrincipalDep, session: SessionDep, access: AccessDep
) -> list[SyncJobOut]:
    source = await session.get(Source, source_id)
    if source is None or await access.role_for(principal, source.collection_id) is None:
        raise not_found("Source")
    rows = await session.scalars(
        select(IngestionJob)
        .where(IngestionJob.source_id == source_id, IngestionJob.kind == "sync")
        .order_by(IngestionJob.started_at.desc())
        .limit(20)
    )
    return [
        SyncJobOut(
            id=j.id,
            status=j.status,
            started_at=j.started_at,
            finished_at=j.finished_at,
            stats=j.stats,
            error=j.error,
        )
        for j in rows.all()
    ]
