from __future__ import annotations

import uuid
from collections.abc import Callable

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from kb.core.container import Container
from kb.retrieval.retriever import RetrievalConfig
from kb.retrieval.vector import vector_literal
from tests.integration.helpers import create_collection, standard_setup
from tests.support import parse_sse

QUERIES = [
    "What was the approved marketing budget for Q3?",
    "salary band for L4 engineers",
    "SEV1 escalation secondary on-call minutes",
    "guest wifi network password",
    "budget salary escalation wifi approved",
]
READABLE = {
    "alice": {"handbook", "engineering"},
    "bob": {"handbook", "engineering"},
    "carol": {"handbook", "finance"},
    "dave": {"handbook", "hr"},
    "outsider": set(),
}


@pytest.fixture
async def ids(clean: None, container: Container) -> dict[str, uuid.UUID]:
    return await standard_setup(container)


async def test_search_never_returns_inaccessible_chunks(
    client: AsyncClient, ids: dict[str, uuid.UUID], auth: Callable[..., dict[str, str]]
) -> None:
    by_id = {str(v): k for k, v in ids.items()}
    checked = 0
    for user, readable in READABLE.items():
        for query in QUERIES:
            for mode in ("vector", "lexical", "hybrid"):
                for rerank in (True, False):
                    response = await client.post(
                        "/api/v1/search",
                        headers=auth(user),
                        json={"query": query, "mode": mode, "rerank": rerank, "k": 20},
                    )
                    assert response.status_code == 200
                    for hit in response.json()["results"]:
                        checked += 1
                        assert by_id[hit["collection_id"]] in readable, (user, query, mode, hit["title"])
    assert checked > 50


async def test_requested_collections_cannot_widen_access(
    client: AsyncClient, ids: dict[str, uuid.UUID], auth: Callable[..., dict[str, str]]
) -> None:
    response = await client.post(
        "/api/v1/search",
        headers=auth("bob"),
        json={"query": "marketing budget", "collections": [str(ids["finance"])]},
    )
    assert response.json()["results"] == []


async def test_chunk_document_and_download_endpoints_enforce_acl(
    client: AsyncClient, ids: dict[str, uuid.UUID], auth: Callable[..., dict[str, str]], container: Container
) -> None:
    async with container.sessions() as session:
        row = (
            await session.execute(
                text(
                    "select c.id as chunk_id, c.document_id from chunks c where c.collection_id = :c limit 1"
                ),
                {"c": ids["finance"]},
            )
        ).one()
    for path in (
        f"/api/v1/chunks/{row.chunk_id}",
        f"/api/v1/documents/{row.document_id}",
        f"/api/v1/documents/{row.document_id}/download-url",
        f"/api/v1/documents/{row.document_id}/chunks",
    ):
        assert (await client.get(path, headers=auth("bob"))).status_code == 404, path
        assert (await client.get(path, headers=auth("carol"))).status_code == 200, path
    url = (
        await client.get(f"/api/v1/documents/{row.document_id}/download-url", headers=auth("carol"))
    ).json()["url"]
    assert "X-Amz-Expires=300" in url
    assert (
        await client.post(f"/api/v1/documents/{row.document_id}/reindex", headers=auth("bob"))
    ).status_code == 404
    assert (
        await client.delete(f"/api/v1/documents/{row.document_id}", headers=auth("bob"))
    ).status_code == 404


async def test_chat_sources_respect_acl_and_bob_gets_no_answer(
    client: AsyncClient, ids: dict[str, uuid.UUID], auth: Callable[..., dict[str, str]]
) -> None:
    answers = {}
    for user in ("carol", "bob"):
        conversation = (await client.post("/api/v1/chat/conversations", headers=auth(user), json={})).json()
        response = await client.post(
            f"/api/v1/chat/conversations/{conversation['id']}/messages",
            headers=auth(user),
            json={"content": "What was the approved marketing budget for Q3?"},
        )
        events = parse_sse(response.text)
        answers[user] = events
        meta = events[0][1]
        for source in meta["sources"]:
            assert user == "carol" or "Budget" not in source["title"]
    carol_done = answers["carol"][-1][1]
    assert answers["carol"][-1][0] == "done"
    assert "$420,000" in carol_done["content"]
    assert carol_done["citations"][0]["title"] == "Q3 Budget"
    assert [e for e, _ in answers["bob"]] == ["meta", "no_answer", "done"]
    assert answers["bob"][-1][1]["status"] == "no_answer"


async def test_prefilter_with_iterative_hnsw_scan_finds_rows_in_small_allowed_collection(
    container: Container, clean: None
) -> None:
    big = await create_collection(container, "Big", [("group", "x", "viewer")])
    small = await create_collection(container, "Small", [("group", "y", "viewer")])
    embedder = container.embedder_for("hash-384")
    async with container.sessions() as session, session.begin():
        await session.execute(
            text(
                "insert into documents (id, collection_id, title, mime_type, content_hash, status) "
                "values (:b, :bc, 'big', 'text/plain', '', 'ready'), (:s, :sc, 'small', 'text/plain', '', 'ready')"
            ),
            {"b": uuid.uuid4(), "bc": big, "s": uuid.uuid4(), "sc": small},
        )
        docs: dict[str, uuid.UUID] = dict(
            (await session.execute(text("select title, id from documents"))).all()
        )
        vectors = await embedder.embed_documents(
            [f"engineering topic number {i} about deployments" for i in range(2000)]
        )
        for i, vector in enumerate(vectors):
            target = small if i % 400 == 0 else big
            await session.execute(
                text(
                    "insert into chunks (id, document_id, collection_id, ordinal, text, token_count, content_hash, "
                    "embedding, embedding_model) values (gen_random_uuid(), :d, :c, :o, :t, 5, :h, cast(:e as vector), "
                    "'hash-384')"
                ),
                {
                    "d": docs["small"] if target == small else docs["big"],
                    "c": target,
                    "o": i,
                    "t": f"engineering topic number {i} about deployments",
                    "h": str(i),
                    "e": vector_literal(vector),
                },
            )
    result = await container.retriever().retrieve(
        "engineering topic about deployments",
        {small: "hash-384"},
        RetrievalConfig(mode="vector", rerank=False, k=5, vector_k=5, ef_search=10, max_per_document=10),
    )
    assert len(result.candidates) == 5
    assert len(result.chunks) == 5
    assert all(c.collection_id == small for c in result.candidates)
