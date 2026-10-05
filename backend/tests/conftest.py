from __future__ import annotations

import os
import uuid
from collections.abc import AsyncIterator, Callable, Iterator

import pytest
from httpx import ASGITransport, AsyncClient
from redis import Redis as SyncRedis
from sqlalchemy import text

from kb.config import Settings
from kb.core.container import Container, build_container
from kb.core.dbadmin import create_database, drop_database, migrate
from kb.core.security import StaticJwks, TokenVerifier
from kb.core.storage import ObjectStorage
from kb.documents import dispatch
from kb.main import create_app
from tests.support import AUDIENCE, ISSUER, Infra, KeyPair, infrastructure, make_settings

os.environ.setdefault("HF_HUB_OFFLINE", "1")


def pytest_collection_modifyitems(items: list[pytest.Item]) -> None:
    for item in items:
        if "/integration/" in str(item.fspath) or "/eval/" in str(item.fspath):
            item.add_marker(pytest.mark.integration)


@pytest.fixture(scope="session")
def infra() -> Iterator[Infra]:
    with infrastructure() as value:
        yield value


@pytest.fixture(scope="session")
def keys() -> KeyPair:
    return KeyPair()


@pytest.fixture(scope="session")
def settings(infra: Infra) -> Iterator[Settings]:
    cfg = make_settings(infra)
    create_database(cfg.database_url, exist_ok=False)
    migrate(cfg.database_url)
    storage = ObjectStorage(cfg)
    storage.ensure_bucket_sync()
    try:
        yield cfg
    finally:
        drop_database(cfg.database_url)
        try:
            storage.remove_bucket_sync()
        except Exception:
            pass
        client = SyncRedis.from_url(cfg.redis_url)
        keys = list(client.scan_iter(f"{cfg.redis_prefix}:*"))
        if keys:
            client.delete(*keys)
        client.close()


@pytest.fixture(scope="session")
async def container(settings: Settings, keys: KeyPair) -> AsyncIterator[Container]:
    verifier = TokenVerifier(StaticJwks(keys.jwks()), ISSUER, AUDIENCE)
    value = build_container(settings, verifier)
    try:
        yield value
    finally:
        await value.aclose()


@pytest.fixture
async def clean(container: Container) -> AsyncIterator[None]:
    async with container.sessions() as session, session.begin():
        await session.execute(
            text(
                "truncate collections, collection_grants, sources, documents, chunks, conversations, messages, "
                "query_logs, feedback, eval_runs, eval_results, ingestion_jobs, staged_chunks, web_page_states cascade"
            )
        )
    await container.redis.incr(f"{container.settings.redis_prefix}:acl:version")
    yield


@pytest.fixture
def dispatched() -> Iterator[list[tuple[str, uuid.UUID]]]:
    calls: list[tuple[str, uuid.UUID]] = []
    dispatch.set_dispatcher("ingest", lambda document_id, force=False: calls.append(("ingest", document_id)))
    dispatch.set_dispatcher("sync", lambda source_id: calls.append(("sync", source_id)))
    dispatch.set_dispatcher("eval", lambda run_id: calls.append(("eval", run_id)))
    try:
        yield calls
    finally:
        for name in ("ingest", "sync", "eval"):
            dispatch.set_dispatcher(name, None)


@pytest.fixture
async def client(container: Container, dispatched: list[tuple[str, uuid.UUID]]) -> AsyncIterator[AsyncClient]:
    app = create_app(container.settings, container=container)
    app.state.container = container
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", timeout=60) as value:
        yield value


AuthHeaders = Callable[..., dict[str, str]]


@pytest.fixture
def auth(keys: KeyPair) -> AuthHeaders:
    def headers(user: str, groups: list[str] | None = None) -> dict[str, str]:
        return {"Authorization": f"Bearer {keys.token(user, groups)}"}

    return headers
