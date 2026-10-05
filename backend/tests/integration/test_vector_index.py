from __future__ import annotations

from sqlalchemy import text

from kb.core.container import Container
from kb.retrieval.vector import vector_literal


async def test_vector_query_uses_partial_hnsw_index(container: Container, clean: None) -> None:
    query = vector_literal([0.1] * 384)
    async with container.sessions() as session, session.begin():
        await session.execute(text("set local enable_seqscan = off"))
        plan = await session.execute(
            text(
                """
            explain select id from chunks
            where embedding_model = 'hash-384'
            order by (embedding::vector(384)) <=> cast(:q as vector(384)) limit 40
            """
            ),
            {"q": query},
        )
        lines = "\n".join(r[0] for r in plan)
    assert "ix_chunks_emb_hash_384" in lines


async def test_indexes_exist_for_default_models(container: Container) -> None:
    async with container.sessions() as session:
        names = set(
            (
                await session.execute(text("select indexname from pg_indexes where tablename = 'chunks'"))
            ).scalars()
        )
    assert {"ix_chunks_emb_hash_384", "ix_chunks_emb_baai_bge_small_en_v1_5", "ix_chunks_tsv"} <= names
