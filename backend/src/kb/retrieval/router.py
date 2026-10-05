from __future__ import annotations

import uuid
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from kb.deps import ContainerDep, PrincipalDep
from kb.retrieval.lexical import headline
from kb.retrieval.retriever import RetrievalConfig

router = APIRouter(tags=["search"])


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    collections: list[uuid.UUID] | None = None
    mode: Literal["vector", "lexical", "hybrid"] = "hybrid"
    rerank: bool = True
    k: int = Field(default=8, ge=1, le=50)


class SearchScores(BaseModel):
    vector_rank: int | None
    vector_score: float | None
    lexical_rank: int | None
    lexical_score: float | None
    rrf: float
    rerank: float | None


class SearchHit(BaseModel):
    rank: int
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    collection_id: uuid.UUID
    title: str
    mime_type: str
    heading_path: list[str]
    page: int | None
    page_end: int | None
    snippet: str
    text: str
    scores: SearchScores


class SearchResponse(BaseModel):
    query: str
    mode: str
    rerank: bool
    results: list[SearchHit]
    candidates: int
    timings_ms: dict[str, float]
    degraded: list[str] = []


@router.post("/search", response_model=SearchResponse, operation_id="search")
async def search(body: SearchRequest, principal: PrincipalDep, container: ContainerDep) -> SearchResponse:
    allowed = await container.access.allowed_collections(principal)
    if body.collections:
        requested = set(body.collections)
        allowed = {cid: model for cid, model in allowed.items() if cid in requested}
    s = container.settings
    config = RetrievalConfig(
        mode=body.mode,
        rerank=body.rerank and container.reranker is not None,
        k=body.k,
        vector_k=s.vector_top_k,
        lexical_k=s.lexical_top_k,
        fused_k=max(s.fused_top_k, body.k),
        rrf_k=s.rrf_k,
        max_per_document=s.max_chunks_per_document,
        mmr_lambda=s.mmr_lambda,
        ef_search=s.hnsw_ef_search,
        embed_timeout_s=s.embed_timeout_seconds,
        rerank_timeout_s=s.rerank_timeout_seconds,
    )
    result = await container.retriever().retrieve(body.query, allowed, config)
    async with container.sessions() as session:
        snippets = await headline(session, [c.chunk_id for c in result.chunks], body.query)
    hits = [
        SearchHit(
            rank=index + 1,
            chunk_id=c.chunk_id,
            document_id=c.document_id,
            collection_id=c.collection_id,
            title=c.title,
            mime_type=c.mime_type,
            heading_path=c.heading_path,
            page=c.page_start,
            page_end=c.page_end,
            snippet=snippets.get(c.chunk_id) or c.text[:300],
            text=c.text,
            scores=SearchScores(
                vector_rank=c.vector_rank,
                vector_score=c.vector_score,
                lexical_rank=c.lexical_rank,
                lexical_score=c.lexical_score,
                rrf=round(c.rrf, 6),
                rerank=c.rerank_score,
            ),
        )
        for index, c in enumerate(result.chunks)
    ]
    return SearchResponse(
        query=body.query,
        mode=body.mode,
        rerank=config.rerank,
        results=hits,
        candidates=len(result.candidates),
        timings_ms=result.timings_ms,
        degraded=result.degraded,
    )
