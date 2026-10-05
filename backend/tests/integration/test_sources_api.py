from __future__ import annotations

import uuid
from collections.abc import Callable

import httpx
import pytest
import respx
from httpx import AsyncClient
from sqlalchemy import text

from kb.connectors.sync import SyncService, due_sources
from kb.connectors.web_crawler import WebCrawler
from kb.core.container import Container
from tests.integration.helpers import create_collection, ingest

SITE = "https://wiki.example.test"


@pytest.fixture
async def collection(clean: None, container: Container) -> uuid.UUID:
    return await create_collection(container, "Wiki", [("group", "engineering", "owner")])


def html(title: str, body: str) -> str:
    return f"<html><head><title>{title}</title></head><body><main><h1>{title}</h1><p>{body}</p></main></body></html>"


async def test_source_validation_and_crud(
    client: AsyncClient, collection: uuid.UUID, auth: Callable[..., dict[str, str]]
) -> None:
    headers = auth("alice")
    bad = await client.post(
        f"/api/v1/collections/{collection}/sources",
        headers=headers,
        json={"kind": "web", "config": {"startUrl": "ftp://x", "includePatterns": ["("]}},
    )
    assert bad.status_code == 422
    bad_cron = await client.post(
        f"/api/v1/collections/{collection}/sources",
        headers=headers,
        json={"kind": "web", "config": {"startUrl": f"{SITE}/"}, "schedule": "every day"},
    )
    assert bad_cron.status_code == 422
    created = await client.post(
        f"/api/v1/collections/{collection}/sources",
        headers=headers,
        json={"kind": "web", "config": {"startUrl": f"{SITE}/", "maxDepth": 1}, "schedule": "*/30 * * * *"},
    )
    assert created.status_code == 201
    source = created.json()
    assert source["config"]["respectRobots"] is True
    patched = await client.patch(
        f"/api/v1/collections/{collection}/sources/{source['id']}", headers=headers, json={"schedule": None}
    )
    assert patched.json()["schedule"] is None
    assert (await client.post(f"/api/v1/sources/{source['id']}/sync", headers=auth("bob"))).status_code == 404
    assert (await client.post(f"/api/v1/sources/{source['id']}/sync", headers=headers)).status_code == 202
    assert len((await client.get(f"/api/v1/collections/{collection}/sources", headers=headers)).json()) == 1
    assert (
        await client.delete(f"/api/v1/collections/{collection}/sources/{source['id']}", headers=headers)
    ).status_code == 204


@respx.mock
async def test_web_sync_creates_updates_and_deletes_documents(
    client: AsyncClient, container: Container, collection: uuid.UUID, auth: Callable[..., dict[str, str]]
) -> None:
    respx.get(f"{SITE}/robots.txt").mock(return_value=httpx.Response(404))
    sitemap = (
        '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        f"<url><loc>{SITE}/deploys</loc></url><url><loc>{SITE}/oncall</loc></url></urlset>"
    )
    respx.get(f"{SITE}/sitemap.xml").mock(return_value=httpx.Response(200, text=sitemap))
    deploys = respx.get(f"{SITE}/deploys").mock(
        return_value=httpx.Response(
            200,
            html=html("Deploys", "Release trains leave on Tuesdays and Thursdays."),
            headers={"ETag": '"d1"'},
        )
    )
    oncall = respx.get(f"{SITE}/oncall").mock(
        return_value=httpx.Response(200, html=html("On-call", "Primary on-call rotates weekly on Monday."))
    )
    created = await client.post(
        f"/api/v1/collections/{collection}/sources",
        headers=auth("alice"),
        json={"kind": "web", "config": {"startUrl": f"{SITE}/sitemap.xml"}, "schedule": "0 * * * *"},
    )
    source_id = uuid.UUID(created.json()["id"])
    assert source_id in await due_sources(container)
    service = SyncService(container, WebCrawler(client=httpx.AsyncClient(), requests_per_second=1000))
    first = await service.sync(source_id)
    assert first.stats["created"] == 2
    for document_id in first.to_ingest:
        await ingest(container, document_id)
    assert source_id not in await due_sources(container)
    deploys.mock(return_value=httpx.Response(304))
    oncall.mock(return_value=httpx.Response(404))
    second = await service.sync(source_id)
    assert second.stats == {
        "fetched": 0,
        "created": 0,
        "updated": 0,
        "unchanged": 1,
        "deleted": 1,
        "errors": 0,
    }
    assert deploys.calls.last.request.headers["If-None-Match"] == '"d1"'
    search = await client.post(
        "/api/v1/search", headers=auth("alice"), json={"query": "release trains Tuesdays"}
    )
    titles = [r["title"] for r in search.json()["results"]]
    assert titles[0] == "Deploys"
    assert "On-call" not in titles
    jobs = (await client.get(f"/api/v1/sources/{source_id}/jobs", headers=auth("alice"))).json()
    assert [j["stats"]["deleted"] for j in jobs] == [1, 0]
    async with container.sessions() as session:
        status = await session.scalar(text("select status from sources where id = :s"), {"s": source_id})
    assert status == "ok"
