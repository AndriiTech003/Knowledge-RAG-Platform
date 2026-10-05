from __future__ import annotations

import asyncio
import uuid
from collections.abc import Callable

import httpx
from httpx import AsyncClient

from kb.core.container import Container
from tests.integration.helpers import standard_setup
from tests.support import parse_sse


class SlowReranker:
    name = "slow"

    async def rerank(self, query: str, passages: list[str]) -> list[float]:
        await asyncio.sleep(5)
        return [1.0] * len(passages)


class BrokenEmbedder:
    model = "hash-384"
    dim = 384

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        raise httpx.ConnectError("models service down")

    async def embed_query(self, text: str) -> list[float]:
        raise httpx.ConnectError("models service down")


async def test_slow_reranker_degrades_to_rrf_instead_of_failing(
    client: AsyncClient, clean: None, container: Container, auth: Callable[..., dict[str, str]]
) -> None:
    await standard_setup(container)
    original = container.reranker
    timeout = container.settings.rerank_timeout_seconds
    container.reranker = SlowReranker()
    container.settings.rerank_timeout_seconds = 0.2
    try:
        search = await client.post(
            "/api/v1/search", headers=auth("carol"), json={"query": "Q3 marketing budget"}
        )
        conversation = (
            await client.post("/api/v1/chat/conversations", headers=auth("carol"), json={})
        ).json()["id"]
        chat = await client.post(
            f"/api/v1/chat/conversations/{conversation}/messages",
            headers=auth("carol"),
            json={"content": "What was the approved marketing budget for Q3?"},
        )
    finally:
        container.reranker = original
        container.settings.rerank_timeout_seconds = timeout
    assert search.status_code == 200
    assert search.json()["degraded"] == ["rerank_unavailable"]
    assert search.json()["results"][0]["title"] == "Q3 Budget"
    events = parse_sse(chat.text)
    assert events[0][1]["degraded"] == ["rerank_unavailable"]
    assert "rerank_unavailable" in events[-1][1]["warnings"]


async def test_embedding_outage_falls_back_to_lexical(
    client: AsyncClient, clean: None, container: Container, auth: Callable[..., dict[str, str]]
) -> None:
    await standard_setup(container)
    original = container.embedders.get("hash-384")
    container.embedders["hash-384"] = BrokenEmbedder()
    try:
        search = await client.post(
            "/api/v1/search", headers=auth("carol"), json={"query": "marketing budget", "mode": "vector"}
        )
    finally:
        if original is not None:
            container.embedders["hash-384"] = original
    body = search.json()
    assert search.status_code == 200
    assert "embedding_unavailable" in body["degraded"]
    assert body["results"][0]["scores"]["lexical_rank"] == 1
    assert uuid.UUID(body["results"][0]["chunk_id"])
