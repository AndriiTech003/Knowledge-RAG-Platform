from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import case, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from kb.core.models import Collection, CollectionGrant, Document


class CollectionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, collection_id: uuid.UUID) -> Collection | None:
        return await self.session.get(Collection, collection_id)

    async def list_by_ids(
        self, ids: Sequence[uuid.UUID], after: tuple[str, uuid.UUID] | None, limit: int
    ) -> list[Collection]:
        if not ids:
            return []
        query = select(Collection).where(Collection.id.in_(list(ids)))
        if after is not None:
            query = query.where(
                (Collection.name > after[0]) | ((Collection.name == after[0]) & (Collection.id > after[1]))
            )
        query = query.order_by(Collection.name, Collection.id).limit(limit)
        return list((await self.session.scalars(query)).all())

    async def document_counts(self, ids: Sequence[uuid.UUID]) -> dict[uuid.UUID, tuple[int, int]]:
        if not ids:
            return {}
        rows = await self.session.execute(
            select(
                Document.collection_id,
                func.count(),
                func.sum(case((Document.status == "ready", 1), else_=0)),
            )
            .where(Document.collection_id.in_(list(ids)), Document.status != "deleted")
            .group_by(Document.collection_id)
        )
        return {r[0]: (int(r[1]), int(r[2] or 0)) for r in rows}

    async def grants(self, collection_id: uuid.UUID) -> list[CollectionGrant]:
        query = (
            select(CollectionGrant)
            .where(CollectionGrant.collection_id == collection_id)
            .order_by(CollectionGrant.principal_type, CollectionGrant.principal_id)
        )
        return list((await self.session.scalars(query)).all())

    async def replace_grants(self, collection_id: uuid.UUID, grants: list[CollectionGrant]) -> None:
        await self.session.execute(
            delete(CollectionGrant).where(CollectionGrant.collection_id == collection_id)
        )
        self.session.add_all(grants)
