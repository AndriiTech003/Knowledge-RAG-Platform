from __future__ import annotations

import uuid
from collections.abc import Callable
from pathlib import Path

import httpx
import pytest
from httpx import AsyncClient
from sqlalchemy import text

from kb.core.container import Container
from tests.integration.helpers import add_document, create_collection, ingest

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"


def handbook(sections: dict[str, str]) -> str:
    parts = ["# Employee Handbook", "Welcome to Northwind."]
    for title, body in sections.items():
        parts += [f"## {title}", body]
    return "\n\n".join(parts) + "\n"


SECTIONS = {
    f"Section {i}": " ".join(f"Rule {i}.{j} explains topic {i} in detail." for j in range(12))
    for i in range(10)
}


@pytest.fixture
async def collection(clean: None, container: Container) -> uuid.UUID:
    return await create_collection(container, "Docs", [("group", "engineering", "editor")])


async def chunk_rows(container: Container, document_id: uuid.UUID) -> list[tuple[str, str]]:
    async with container.sessions() as session:
        rows = await session.execute(
            text("select id::text, content_hash from chunks where document_id = :d order by ordinal"),
            {"d": document_id},
        )
        return [(r[0], r[1]) for r in rows]


async def test_incremental_reindex_only_embeds_changed_chunks(
    container: Container, collection: uuid.UUID
) -> None:
    document_id = await add_document(container, collection, "handbook.md", handbook(SECTIONS).encode())
    first = await ingest(container, document_id)
    assert first is not None
    assert first["chunks_new"] == first["chunks_total"] >= 10
    before = await chunk_rows(container, document_id)
    changed = dict(SECTIONS)
    changed["Section 3"] = "This section was rewritten completely with new guidance about laptops."
    key = await chunk_storage_key(container, document_id)
    await container.storage.put_bytes(key, handbook(changed).encode(), "text/markdown")
    second = await ingest(container, document_id)
    assert second is not None
    assert second["chunks_new"] == 1
    assert second["chunks_unchanged"] == second["chunks_total"] - 1
    assert second["chunks_deleted"] == 1
    after = await chunk_rows(container, document_id)
    assert len(set(before) & set(after)) == len(after) - 1


async def chunk_storage_key(container: Container, document_id: uuid.UUID) -> str:
    async with container.sessions() as session:
        return str(
            await session.scalar(text("select storage_key from documents where id = :d"), {"d": document_id})
        )


async def test_unchanged_document_is_skipped_and_forced_reindex_reuses_embeddings(
    container: Container, collection: uuid.UUID
) -> None:
    document_id = await add_document(container, collection, "handbook.md", handbook(SECTIONS).encode())
    first = await ingest(container, document_id)
    skipped = await ingest(container, document_id)
    assert skipped is None
    async with container.sessions() as session:
        job = (
            await session.execute(
                text(
                    "select stats from ingestion_jobs where document_id = :d order by started_at desc limit 1"
                ),
                {"d": document_id},
            )
        ).scalar_one()
    assert job["skipped"] is True
    forced = await ingest(container, document_id, force=True)
    assert forced is not None and first is not None
    assert forced["chunks_new"] == 0
    assert forced["chunks_unchanged"] == first["chunks_total"]


async def test_pdf_ingestion_records_pages_and_status_events(
    container: Container, collection: uuid.UUID
) -> None:
    pubsub = container.redis.pubsub()
    await pubsub.subscribe(f"{container.settings.redis_prefix}:events:documents")
    document_id = await add_document(
        container, collection, "manual.pdf", (FIXTURES / "hard.pdf").read_bytes()
    )
    stats = await ingest(container, document_id)
    assert stats is not None
    async with container.sessions() as session:
        doc = (
            await session.execute(
                text("select status, page_count, title, mime_type from documents where id = :d"),
                {"d": document_id},
            )
        ).one()
        pages = (
            await session.execute(
                text("select page_start from chunks where document_id = :d and text like '%FR-209%'"),
                {"d": document_id},
            )
        ).scalar()
    assert doc.status == "ready" and doc.page_count == 3 and doc.title == "Field Operations Manual"
    assert pages == 3
    statuses = []
    for _ in range(20):
        message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=0.2)
        if message:
            import json

            statuses.append(json.loads(message["data"])["status"])
    await pubsub.close()
    assert statuses[:4] == ["parsing", "chunking", "embedding", "ready"]


async def test_scanned_pdf_fails_with_no_text_layer(container: Container, collection: uuid.UUID) -> None:
    document_id = await add_document(
        container, collection, "scan.pdf", (FIXTURES / "scanned.pdf").read_bytes()
    )
    assert await ingest(container, document_id) is None
    async with container.sessions() as session:
        row = (
            await session.execute(
                text("select status, error from documents where id = :d"), {"d": document_id}
            )
        ).one()
    assert (row.status, row.error) == ("failed", "no_text_layer")


async def test_upload_flow_through_api_with_presigned_put(
    client: AsyncClient,
    container: Container,
    collection: uuid.UUID,
    auth: Callable[..., dict[str, str]],
    dispatched: list[tuple[str, uuid.UUID]],
) -> None:
    data = (FIXTURES / "sample.docx").read_bytes()
    presign = await client.post(
        f"/api/v1/collections/{collection}/documents/upload-url",
        headers=auth("alice"),
        json={"filename": "office moves.docx", "size": len(data)},
    )
    assert presign.status_code == 200
    body = presign.json()
    async with httpx.AsyncClient() as raw:
        put = await raw.put(body["upload_url"], content=data)
    assert put.status_code == 200
    registered = await client.post(
        f"/api/v1/collections/{collection}/documents",
        headers=auth("alice"),
        json={"storage_key": body["storage_key"], "filename": "office moves.docx"},
    )
    assert registered.status_code == 201
    document = registered.json()
    assert document["status"] == "queued"
    assert dispatched == [("ingest", uuid.UUID(document["id"]))]
    await ingest(container, uuid.UUID(document["id"]))
    detail = (await client.get(f"/api/v1/documents/{document['id']}", headers=auth("alice"))).json()
    assert detail["status"] == "ready"
    assert detail["title"] == "Office Moves Guide"
    assert detail["chunk_stats"]["chunks"] >= 2
    assert detail["jobs"][0]["stats"]["chunks_new"] == detail["chunk_stats"]["chunks"]
    again = await client.post(
        f"/api/v1/collections/{collection}/documents",
        headers=auth("alice"),
        json={"storage_key": body["storage_key"], "filename": "office moves.docx"},
    )
    assert again.status_code == 200
    chunks = (
        await client.get(f"/api/v1/documents/{document['id']}/chunks?limit=1", headers=auth("alice"))
    ).json()
    assert len(chunks["items"]) == 1 and chunks["next_cursor"]
    nxt = (
        await client.get(
            f"/api/v1/documents/{document['id']}/chunks?limit=1&cursor={chunks['next_cursor']}",
            headers=auth("alice"),
        )
    ).json()
    assert nxt["items"][0]["ordinal"] == 1


async def test_upload_rejects_executables_large_files_and_foreign_keys(
    client: AsyncClient, container: Container, collection: uuid.UUID, auth: Callable[..., dict[str, str]]
) -> None:
    too_big = await client.post(
        f"/api/v1/collections/{collection}/documents/upload-url",
        headers=auth("alice"),
        json={"filename": "x.pdf", "size": 10**9},
    )
    assert too_big.status_code == 413
    bad_ext = await client.post(
        f"/api/v1/collections/{collection}/documents/upload-url",
        headers=auth("alice"),
        json={"filename": "x.exe", "size": 10},
    )
    assert bad_ext.status_code == 415
    presign = (
        await client.post(
            f"/api/v1/collections/{collection}/documents/upload-url",
            headers=auth("alice"),
            json={"filename": "evil.pdf", "size": 100},
        )
    ).json()
    async with httpx.AsyncClient() as raw:
        await raw.put(presign["upload_url"], content=b"\x7fELF\x02\x01\x01" + b"\0" * 100)
    rejected = await client.post(
        f"/api/v1/collections/{collection}/documents",
        headers=auth("alice"),
        json={"storage_key": presign["storage_key"], "filename": "evil.pdf"},
    )
    assert rejected.status_code == 415
    foreign = await client.post(
        f"/api/v1/collections/{collection}/documents",
        headers=auth("alice"),
        json={"storage_key": f"collections/{uuid.uuid4()}/uploads/x/y.pdf", "filename": "y.pdf"},
    )
    assert foreign.status_code == 400


async def test_delete_document_removes_chunks(
    client: AsyncClient, container: Container, collection: uuid.UUID, auth: Callable[..., dict[str, str]]
) -> None:
    document_id = await add_document(container, collection, "handbook.md", handbook(SECTIONS).encode())
    await ingest(container, document_id)
    assert (await client.delete(f"/api/v1/documents/{document_id}", headers=auth("alice"))).status_code == 204
    assert await chunk_rows(container, document_id) == []
    assert (await client.get(f"/api/v1/documents/{document_id}", headers=auth("alice"))).status_code == 404
    listing = (await client.get(f"/api/v1/collections/{collection}/documents", headers=auth("alice"))).json()
    assert listing["items"] == []
