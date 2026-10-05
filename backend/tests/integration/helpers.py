from __future__ import annotations

import uuid
from typing import Any

from kb.core.container import Container
from kb.core.models import Collection, CollectionGrant, Document
from kb.ingestion.chunking.profiles import ChunkingProfile
from kb.ingestion.parsers import detect_mime
from kb.ingestion.pipeline import IngestionPipeline
from kb.retrieval.vector import ensure_vector_index


async def create_collection(
    container: Container, name: str, grants: list[tuple[str, str, str]], profile: str = "default"
) -> uuid.UUID:
    collection_id = uuid.uuid4()
    async with container.sessions() as session, session.begin():
        await ensure_vector_index(session, container.settings.embedding_model)
        session.add(
            Collection(
                id=collection_id,
                name=name,
                description=f"{name} docs",
                embedding_model=container.settings.embedding_model,
                chunking_profile=profile,
                created_by="test",
            )
        )
        await session.flush()
        for principal_type, principal_id, role in grants:
            session.add(
                CollectionGrant(
                    collection_id=collection_id,
                    principal_type=principal_type,
                    principal_id=principal_id,
                    role=role,
                )
            )
    await container.access.bump_version()
    return collection_id


async def add_document(
    container: Container,
    collection_id: uuid.UUID,
    filename: str,
    data: bytes,
    metadata: dict[str, Any] | None = None,
) -> uuid.UUID:
    document_id = uuid.uuid4()
    key = f"collections/{collection_id}/uploads/{document_id}/{filename}"
    await container.storage.put_bytes(key, data, "application/octet-stream")
    async with container.sessions() as session, session.begin():
        session.add(
            Document(
                id=document_id,
                collection_id=collection_id,
                external_id=f"upload:{filename}",
                title=filename,
                mime_type=detect_mime(data, filename),
                storage_key=key,
                content_hash="",
                status="queued",
                metadata_={"filename": filename, **(metadata or {})},
            )
        )
    return document_id


def pipeline(container: Container, profile: ChunkingProfile | None = None) -> IngestionPipeline:
    return IngestionPipeline(
        container.sessions,
        container.storage,
        container.embedder_for,
        container.token_counter(),
        container.events,
        container.settings,
        profile,
    )


async def ingest(container: Container, document_id: uuid.UUID, force: bool = False) -> dict[str, Any] | None:
    return await pipeline(container).run_inline(document_id, force=force)


async def add_and_ingest(
    container: Container, collection_id: uuid.UUID, filename: str, text: str
) -> uuid.UUID:
    document_id = await add_document(container, collection_id, filename, text.encode())
    await ingest(container, document_id)
    return document_id


async def standard_setup(container: Container) -> dict[str, uuid.UUID]:
    everyone = [("group", g, "viewer") for g in ("engineering", "sales", "finance", "hr")]
    ids = {
        "handbook": await create_collection(container, "Handbook", everyone),
        "engineering": await create_collection(
            container, "Engineering", [("group", "engineering", "editor"), ("user", "sub-bob", "viewer")]
        ),
        "finance": await create_collection(container, "Finance", [("group", "finance", "owner")]),
        "hr": await create_collection(container, "HR", [("group", "hr", "editor")]),
    }
    await add_and_ingest(
        container,
        ids["handbook"],
        "wifi.md",
        "# Guest Wi-Fi\n\nThe guest network is called NW-Guest and the password rotates every Monday.\n",
    )
    await add_and_ingest(
        container,
        ids["engineering"],
        "runbook.md",
        "# Incident runbook\n\n## Escalation\n\nA SEV1 page is escalated to the secondary on-call "
        "after 10 minutes without acknowledgement.\n",
    )
    await add_and_ingest(
        container,
        ids["finance"],
        "q3-budget.md",
        "# Q3 Budget\n\n## Marketing\n\nThe approved Q3 marketing budget is $420,000, approved on "
        "July 2 by the CFO.\n",
    )
    await add_and_ingest(
        container,
        ids["hr"],
        "bands.md",
        "# Compensation bands\n\nThe L4 engineering salary band is $140,000 to $175,000.\n",
    )
    return ids
