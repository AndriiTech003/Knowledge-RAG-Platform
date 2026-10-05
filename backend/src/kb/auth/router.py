from __future__ import annotations

import uuid

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import select

from kb.core.models import Collection
from kb.deps import AccessDep, PrincipalDep, SessionDep

router = APIRouter(tags=["me"])


class MeCollection(BaseModel):
    id: uuid.UUID
    name: str
    role: str


class MeOut(BaseModel):
    sub: str
    email: str | None
    name: str | None
    username: str | None
    groups: list[str]
    is_admin: bool
    collections: list[MeCollection]


@router.get("/me", response_model=MeOut, operation_id="getMe")
async def me(principal: PrincipalDep, access: AccessDep, session: SessionDep) -> MeOut:
    accessible = await access.accessible(principal)
    names: dict[uuid.UUID, str] = {}
    if accessible:
        rows = await session.execute(
            select(Collection.id, Collection.name).where(Collection.id.in_(list(accessible)))
        )
        names = {r.id: r.name for r in rows}
    collections = sorted(
        (MeCollection(id=cid, name=names.get(cid, ""), role=a.role) for cid, a in accessible.items()),
        key=lambda c: c.name,
    )
    return MeOut(
        sub=principal.sub,
        email=principal.email,
        name=principal.name,
        username=principal.username,
        groups=principal.groups,
        is_admin=principal.is_admin,
        collections=collections,
    )
