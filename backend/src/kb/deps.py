from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from kb.access.service import AccessService
from kb.auth.principal import Principal, principal_from_claims
from kb.core.container import Container
from kb.core.errors import forbidden, unauthorized


def get_container(request: Request) -> Container:
    container = request.app.state.container
    assert isinstance(container, Container)
    return container


ContainerDep = Annotated[Container, Depends(get_container)]


async def get_session(container: ContainerDep) -> AsyncIterator[AsyncSession]:
    async with container.sessions() as session:
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_session)]


async def get_principal(request: Request, container: ContainerDep) -> Principal:
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise unauthorized()
    claims = await container.verifier.verify(token.strip())
    principal = principal_from_claims(claims, container.settings.admin_group)
    request.state.principal = principal
    return principal


PrincipalDep = Annotated[Principal, Depends(get_principal)]


async def require_admin(principal: PrincipalDep) -> Principal:
    if not principal.is_admin:
        raise forbidden("Requires kb-admins")
    return principal


AdminDep = Annotated[Principal, Depends(require_admin)]


def get_access(container: ContainerDep) -> AccessService:
    return container.access


AccessDep = Annotated[AccessService, Depends(get_access)]
