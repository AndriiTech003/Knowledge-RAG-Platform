from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from typing import Literal

from redis.asyncio import Redis
from redis.exceptions import RedisError
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from kb.auth.principal import Principal
from kb.config import Settings
from kb.core.errors import forbidden, not_found
from kb.core.redis import key

Action = Literal["read", "write", "manage"]
ROLE_RANK = {"viewer": 1, "editor": 2, "owner": 3}
ACTION_MIN_ROLE: dict[str, int] = {"read": 1, "write": 2, "manage": 3}


@dataclass(frozen=True)
class CollectionAccess:
    collection_id: uuid.UUID
    embedding_model: str
    role: str


def can(role: str | None, action: Action) -> bool:
    return role is not None and ROLE_RANK.get(role, 0) >= ACTION_MIN_ROLE[action]


class AccessService:
    def __init__(self, sessions: async_sessionmaker[AsyncSession], redis: Redis, settings: Settings) -> None:
        self.sessions = sessions
        self.redis = redis
        self.settings = settings

    def _version_key(self) -> str:
        return key(self.settings, "acl", "version")

    async def version(self) -> str:
        try:
            value = await self.redis.get(self._version_key())
        except RedisError:
            return "nocache"
        return str(value or "0")

    async def bump_version(self) -> None:
        try:
            await self.redis.incr(self._version_key())
        except RedisError:
            return

    async def _compute(self, principal: Principal) -> dict[uuid.UUID, CollectionAccess]:
        async with self.sessions() as session:
            if principal.is_admin:
                rows = await session.execute(text("select id, embedding_model from collections"))
                return {r.id: CollectionAccess(r.id, r.embedding_model, "owner") for r in rows}
            rows = await session.execute(
                text(
                    """
                    select g.collection_id, c.embedding_model, g.role
                    from collection_grants g join collections c on c.id = g.collection_id
                    where (g.principal_type = 'group' and g.principal_id = any(:groups))
                       or (g.principal_type = 'user' and g.principal_id = :sub)
                    """
                ),
                {"groups": principal.groups, "sub": principal.sub},
            )
            result: dict[uuid.UUID, CollectionAccess] = {}
            for row in rows:
                current = result.get(row.collection_id)
                if current is None or ROLE_RANK[row.role] > ROLE_RANK[current.role]:
                    result[row.collection_id] = CollectionAccess(
                        row.collection_id, row.embedding_model, row.role
                    )
            return result

    async def accessible(self, principal: Principal) -> dict[uuid.UUID, CollectionAccess]:
        version = await self.version()
        cache_key = key(self.settings, "acl", principal.sub, principal.groups_hash, version)
        if version != "nocache":
            try:
                cached = await self.redis.get(cache_key)
            except RedisError:
                cached = None
            if cached:
                data = json.loads(cached)
                return {
                    uuid.UUID(cid): CollectionAccess(uuid.UUID(cid), str(v[0]), str(v[1]))
                    for cid, v in data.items()
                }
        result = await self._compute(principal)
        if version != "nocache":
            payload = {str(cid): [a.embedding_model, a.role] for cid, a in result.items()}
            try:
                await self.redis.set(cache_key, json.dumps(payload), ex=self.settings.acl_cache_seconds)
            except RedisError:
                pass
        return result

    async def allowed_collections(self, principal: Principal) -> dict[uuid.UUID, str]:
        return {cid: access.embedding_model for cid, access in (await self.accessible(principal)).items()}

    async def role_for(self, principal: Principal, collection_id: uuid.UUID) -> str | None:
        access = (await self.accessible(principal)).get(collection_id)
        return access.role if access else None

    async def require(self, principal: Principal, collection_id: uuid.UUID, action: Action) -> str:
        role = await self.role_for(principal, collection_id)
        if role is None:
            raise not_found("Collection")
        if not can(role, action):
            raise forbidden(f"Action '{action}' requires a higher role than '{role}'")
        return role
