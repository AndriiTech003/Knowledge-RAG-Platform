from __future__ import annotations

import asyncio

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text

from kb.deps import ContainerDep

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/live", operation_id="healthLive")
async def live() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready", operation_id="healthReady")
async def ready(container: ContainerDep) -> JSONResponse:
    checks: dict[str, str] = {}

    async def db() -> None:
        async with container.sessions() as session:
            await session.execute(text("select 1"))

    async def redis() -> None:
        await container.redis.ping()

    async def storage() -> None:
        await asyncio.to_thread(container.storage.client.bucket_exists, container.storage.bucket)

    for name, check in (("database", db), ("redis", redis), ("storage", storage)):
        try:
            await asyncio.wait_for(check(), timeout=3)
            checks[name] = "ok"
        except Exception as exc:
            checks[name] = f"error: {type(exc).__name__}"
    healthy = all(v == "ok" for v in checks.values())
    return JSONResponse(
        {"status": "ok" if healthy else "degraded", "checks": checks}, status_code=200 if healthy else 503
    )
