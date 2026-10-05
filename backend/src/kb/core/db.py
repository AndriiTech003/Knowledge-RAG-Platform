from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from sqlalchemy.engine import CursorResult, Result
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from kb.config import Settings


def create_engine(settings: Settings) -> AsyncEngine:
    return create_async_engine(
        settings.database_url,
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        pool_pre_ping=True,
    )


def create_sessionmaker(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False)


async def session_scope(factory: async_sessionmaker[AsyncSession]) -> AsyncIterator[AsyncSession]:
    async with factory() as session:
        yield session


def sync_url(url: str) -> str:
    return url.replace("postgresql+asyncpg://", "postgresql+psycopg://")


def rowcount(result: Result[Any]) -> int:
    if isinstance(result, CursorResult):
        return int(result.rowcount or 0)
    return 0
