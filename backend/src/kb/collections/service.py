from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from kb.access.service import AccessService
from kb.auth.principal import Principal
from kb.collections.repository import CollectionRepository
from kb.collections.schemas import CollectionCreate, CollectionOut, CollectionPatch, GrantIn, GrantOut
from kb.config import EMBEDDING_MODELS, Settings
from kb.core.errors import bad_request, not_found
from kb.core.models import Collection, CollectionGrant, Document
from kb.core.pagination import Page, decode_cursor, encode_cursor
from kb.retrieval.vector import ensure_vector_index


def to_out(collection: Collection, role: str, counts: tuple[int, int] = (0, 0)) -> CollectionOut:
    return CollectionOut(
        id=collection.id,
        name=collection.name,
        description=collection.description,
        embedding_model=collection.embedding_model,
        chunking_profile=collection.chunking_profile,
        created_by=collection.created_by,
        created_at=collection.created_at,
        role=role,
        document_count=counts[0],
        ready_count=counts[1],
    )


class CollectionService:
    def __init__(self, session: AsyncSession, access: AccessService, settings: Settings) -> None:
        self.session = session
        self.repo = CollectionRepository(session)
        self.access = access
        self.settings = settings

    async def list_collections(
        self, principal: Principal, cursor: str | None, limit: int
    ) -> Page[CollectionOut]:
        accessible = await self.access.accessible(principal)
        decoded = decode_cursor(cursor)
        after = (str(decoded["name"]), uuid.UUID(str(decoded["id"]))) if decoded else None
        items = await self.repo.list_by_ids(list(accessible), after, limit + 1)
        counts = await self.repo.document_counts([c.id for c in items[:limit]])
        page = [to_out(c, accessible[c.id].role, counts.get(c.id, (0, 0))) for c in items[:limit]]
        next_cursor = None
        if len(items) > limit:
            last = items[limit - 1]
            next_cursor = encode_cursor({"name": last.name, "id": str(last.id)})
        return Page[CollectionOut](items=page, next_cursor=next_cursor)

    async def get(self, principal: Principal, collection_id: uuid.UUID) -> CollectionOut:
        role = await self.access.require(principal, collection_id, "read")
        collection = await self.repo.get(collection_id)
        if collection is None:
            raise not_found("Collection")
        counts = await self.repo.document_counts([collection_id])
        return to_out(collection, role, counts.get(collection_id, (0, 0)))

    def _model(self, name: str | None) -> str:
        model = name or self.settings.embedding_model
        if model not in EMBEDDING_MODELS:
            raise bad_request("UNKNOWN_EMBEDDING_MODEL", f"Embedding model {model} is not supported")
        return model

    async def create(self, principal: Principal, body: CollectionCreate) -> CollectionOut:
        model = self._model(body.embedding_model)
        collection = Collection(
            id=uuid.uuid4(),
            name=body.name,
            description=body.description,
            embedding_model=model,
            chunking_profile=body.chunking_profile,
            created_by=principal.sub,
        )
        self.session.add(collection)
        await self.session.flush()
        grants = self._dedupe(body.grants)
        if not any(g.principal_type == "user" and g.principal_id == principal.sub for g in grants):
            grants.append(GrantIn(principal_type="user", principal_id=principal.sub, role="owner"))
        self.session.add_all(
            CollectionGrant(
                collection_id=collection.id,
                principal_type=g.principal_type,
                principal_id=g.principal_id,
                role=g.role,
            )
            for g in grants
        )
        await ensure_vector_index(self.session, model)
        await self.session.commit()
        await self.session.refresh(collection)
        await self.access.bump_version()
        return to_out(collection, "owner")

    async def patch(
        self, principal: Principal, collection_id: uuid.UUID, body: CollectionPatch
    ) -> tuple[CollectionOut, bool]:
        role = await self.access.require(principal, collection_id, "manage")
        collection = await self.repo.get(collection_id)
        if collection is None:
            raise not_found("Collection")
        reindex = False
        if body.name is not None:
            collection.name = body.name
        if body.description is not None:
            collection.description = body.description
        if body.chunking_profile is not None and body.chunking_profile != collection.chunking_profile:
            collection.chunking_profile = body.chunking_profile
            reindex = True
        if body.embedding_model is not None and body.embedding_model != collection.embedding_model:
            collection.embedding_model = self._model(body.embedding_model)
            await ensure_vector_index(self.session, collection.embedding_model)
            reindex = True
        await self.session.commit()
        await self.session.refresh(collection)
        if reindex:
            await self.access.bump_version()
        counts = await self.repo.document_counts([collection_id])
        return to_out(collection, role, counts.get(collection_id, (0, 0))), reindex

    async def document_ids(self, collection_id: uuid.UUID) -> list[uuid.UUID]:
        rows = await self.session.scalars(
            select(Document.id).where(Document.collection_id == collection_id, Document.status != "deleted")
        )
        return list(rows.all())

    async def delete(self, principal: Principal, collection_id: uuid.UUID) -> list[str]:
        await self.access.require(principal, collection_id, "manage")
        collection = await self.repo.get(collection_id)
        if collection is None:
            raise not_found("Collection")
        keys = list(
            (
                await self.session.scalars(
                    select(Document.storage_key).where(
                        Document.collection_id == collection_id, Document.storage_key.is_not(None)
                    )
                )
            ).all()
        )
        await self.session.delete(collection)
        await self.session.commit()
        await self.access.bump_version()
        return [k for k in keys if k]

    async def grants(self, principal: Principal, collection_id: uuid.UUID) -> list[GrantOut]:
        await self.access.require(principal, collection_id, "manage")
        return [
            GrantOut.model_validate(
                {"principal_type": g.principal_type, "principal_id": g.principal_id, "role": g.role}
            )
            for g in await self.repo.grants(collection_id)
        ]

    @staticmethod
    def _dedupe(grants: list[GrantIn]) -> list[GrantIn]:
        result: dict[tuple[str, str], GrantIn] = {}
        for grant in grants:
            result[(grant.principal_type, grant.principal_id)] = grant
        return list(result.values())

    async def put_grants(
        self, principal: Principal, collection_id: uuid.UUID, grants: list[GrantIn]
    ) -> list[GrantOut]:
        await self.access.require(principal, collection_id, "manage")
        unique = self._dedupe(grants)
        if not principal.is_admin and not any(g.role == "owner" for g in unique):
            raise bad_request("OWNER_REQUIRED", "At least one owner grant must remain")
        await self.repo.replace_grants(
            collection_id,
            [
                CollectionGrant(
                    collection_id=collection_id,
                    principal_type=g.principal_type,
                    principal_id=g.principal_id,
                    role=g.role,
                )
                for g in unique
            ],
        )
        await self.session.commit()
        await self.access.bump_version()
        return [GrantOut(**g.model_dump()) for g in unique]
