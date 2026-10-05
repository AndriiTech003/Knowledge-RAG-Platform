from __future__ import annotations

import re
import uuid
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from kb.config import embedding_dim

SAFE_MODEL_RE = re.compile(r"^[A-Za-z0-9_.\-/]+$")


@dataclass
class VectorHit:
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    score: float
    rank: int


def _checked(model: str) -> tuple[str, int]:
    if not SAFE_MODEL_RE.match(model):
        raise ValueError(f"invalid model name {model}")
    return model, embedding_dim(model)


def index_name(model: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", model.lower()).strip("_")
    return f"ix_chunks_emb_{slug}"[:63]


def vector_index_ddl(model: str) -> str:
    name, dim = _checked(model)
    return (
        f"create index if not exists {index_name(name)} on chunks using hnsw "
        f"((embedding::vector({dim})) vector_cosine_ops) where embedding_model = '{name}'"
    )


def vector_literal(values: list[float]) -> str:
    return "[" + ",".join(f"{v:.7g}" for v in values) + "]"


async def ensure_vector_index(session: AsyncSession, model: str) -> None:
    await session.execute(text(vector_index_ddl(model)))


async def vector_search(
    session: AsyncSession,
    query_embedding: list[float],
    allowed: list[uuid.UUID],
    model: str,
    limit: int,
    ef_search: int = 100,
) -> list[VectorHit]:
    if not allowed:
        return []
    name, dim = _checked(model)
    await session.execute(text(f"set local hnsw.ef_search = {int(ef_search)}"))
    await session.execute(text("set local hnsw.iterative_scan = relaxed_order"))
    sql = text(
        f"""
        select id, document_id, 1 - ((embedding::vector({dim})) <=> cast(:q as vector({dim}))) as score
        from chunks
        where collection_id = any(:allowed) and embedding_model = '{name}'
        order by (embedding::vector({dim})) <=> cast(:q as vector({dim}))
        limit :limit
        """
    )
    rows = await session.execute(
        sql, {"q": vector_literal(query_embedding), "allowed": allowed, "limit": limit}
    )
    return [
        VectorHit(chunk_id=row.id, document_id=row.document_id, score=float(row.score), rank=index + 1)
        for index, row in enumerate(rows)
    ]
