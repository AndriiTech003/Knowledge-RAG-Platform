from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from kb.core.text import STOPWORDS, tokens


@dataclass
class LexicalHit:
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    score: float
    rank: int


def or_query(query: str) -> str:
    seen: list[str] = []
    for token in tokens(query):
        if token in STOPWORDS or len(token) < 2 or token in seen:
            continue
        seen.append(token)
    return " or ".join(seen)


async def lexical_search(
    session: AsyncSession, query: str, allowed: list[uuid.UUID], limit: int
) -> list[LexicalHit]:
    terms = or_query(query)
    if not allowed or not terms:
        return []
    sql = text(
        """
        with q as (select websearch_to_tsquery('english', :terms) as query)
        select c.id, c.document_id, ts_rank_cd(c.tsv, q.query, 32) as score
        from chunks c, q
        where c.collection_id = any(:allowed) and c.tsv @@ q.query
        order by score desc, c.id
        limit :limit
        """
    )
    rows = await session.execute(sql, {"terms": terms, "allowed": allowed, "limit": limit})
    return [
        LexicalHit(chunk_id=row.id, document_id=row.document_id, score=float(row.score), rank=index + 1)
        for index, row in enumerate(rows)
    ]


async def headline(session: AsyncSession, chunk_ids: list[uuid.UUID], query: str) -> dict[uuid.UUID, str]:
    terms = or_query(query)
    if not chunk_ids or not terms:
        return {}
    sql = text(
        """
        select id, ts_headline('english', text, websearch_to_tsquery('english', :terms),
          'StartSel=<mark>, StopSel=</mark>, MaxWords=60, MinWords=25, MaxFragments=2') as snippet
        from chunks where id = any(:ids)
        """
    )
    rows = await session.execute(sql, {"terms": terms, "ids": chunk_ids})
    return {row.id: str(row.snippet) for row in rows}
