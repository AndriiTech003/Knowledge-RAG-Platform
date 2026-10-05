from __future__ import annotations

import asyncio
import uuid
from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from kb.collections.schemas import CollectionCreate, CollectionOut, CollectionPatch, GrantOut, GrantsUpdate
from kb.collections.service import CollectionService
from kb.core.pagination import Page
from kb.deps import AccessDep, AdminDep, ContainerDep, PrincipalDep, SessionDep
from kb.documents.dispatch import enqueue_ingest

router = APIRouter(prefix="/collections", tags=["collections"])


@router.get("", response_model=Page[CollectionOut], operation_id="listCollections")
async def list_collections(
    principal: PrincipalDep,
    session: SessionDep,
    access: AccessDep,
    container: ContainerDep,
    cursor: str | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> Page[CollectionOut]:
    return await CollectionService(session, access, container.settings).list_collections(
        principal, cursor, limit
    )


@router.post(
    "", response_model=CollectionOut, status_code=status.HTTP_201_CREATED, operation_id="createCollection"
)
async def create_collection(
    body: CollectionCreate,
    principal: AdminDep,
    session: SessionDep,
    access: AccessDep,
    container: ContainerDep,
) -> CollectionOut:
    return await CollectionService(session, access, container.settings).create(principal, body)


@router.get("/{collection_id}", response_model=CollectionOut, operation_id="getCollection")
async def get_collection(
    collection_id: uuid.UUID,
    principal: PrincipalDep,
    session: SessionDep,
    access: AccessDep,
    container: ContainerDep,
) -> CollectionOut:
    return await CollectionService(session, access, container.settings).get(principal, collection_id)


@router.patch("/{collection_id}", response_model=CollectionOut, operation_id="updateCollection")
async def patch_collection(
    collection_id: uuid.UUID,
    body: CollectionPatch,
    principal: PrincipalDep,
    session: SessionDep,
    access: AccessDep,
    container: ContainerDep,
) -> CollectionOut:
    service = CollectionService(session, access, container.settings)
    result, reindex = await service.patch(principal, collection_id, body)
    if reindex:
        for document_id in await service.document_ids(collection_id):
            enqueue_ingest(document_id, force=True)
    return result


@router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT, operation_id="deleteCollection")
async def delete_collection(
    collection_id: uuid.UUID,
    principal: PrincipalDep,
    session: SessionDep,
    access: AccessDep,
    container: ContainerDep,
) -> Response:
    keys = await CollectionService(session, access, container.settings).delete(principal, collection_id)
    for key in keys:
        await asyncio.shield(container.storage.delete(key))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{collection_id}/grants", response_model=list[GrantOut], operation_id="getCollectionGrants")
async def get_grants(
    collection_id: uuid.UUID,
    principal: PrincipalDep,
    session: SessionDep,
    access: AccessDep,
    container: ContainerDep,
) -> list[GrantOut]:
    return await CollectionService(session, access, container.settings).grants(principal, collection_id)


@router.put("/{collection_id}/grants", response_model=list[GrantOut], operation_id="putCollectionGrants")
async def put_grants(
    collection_id: uuid.UUID,
    body: GrantsUpdate,
    principal: PrincipalDep,
    session: SessionDep,
    access: AccessDep,
    container: ContainerDep,
) -> list[GrantOut]:
    return await CollectionService(session, access, container.settings).put_grants(
        principal, collection_id, body.grants
    )
