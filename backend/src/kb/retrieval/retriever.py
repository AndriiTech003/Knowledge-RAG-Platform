from __future__ import annotations

import asyncio
import time
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Literal

import httpx
from opentelemetry import trace
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from kb.providers.embedders.base import Embedder
from kb.providers.rerankers.base import Reranker
from kb.retrieval.fusion import rrf
from kb.retrieval.lexical import LexicalHit, lexical_search
from kb.retrieval.mmr import mmr_dedupe
from kb.retrieval.vector import VectorHit, vector_search

Mode = Literal["vector", "lexical", "hybrid"]
tracer = trace.get_tracer("kb.retrieval")


class RetrievalConfig(BaseModel):
    mode: Mode = "hybrid"
    rerank: bool = True
    k: int = 8
    vector_k: int = 40
    lexical_k: int = 40
    fused_k: int = 20
    rrf_k: int = 60
    max_per_document: int = 3
    mmr_lambda: float = 0.75
    ef_search: int = 100
    embed_timeout_s: float = 10.0
    rerank_timeout_s: float = 8.0


@dataclass
class ScoredChunk:
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    collection_id: uuid.UUID
    title: str
    mime_type: str
    text: str
    heading_path: list[str]
    page_start: int | None
    page_end: int | None
    char_start: int | None
    char_end: int | None
    vector_rank: int | None = None
    vector_score: float | None = None
    lexical_rank: int | None = None
    lexical_score: float | None = None
    rrf: float = 0.0
    rerank_score: float | None = None

    @property
    def relevance(self) -> float:
        if self.rerank_score is not None:
            return self.rerank_score
        return self.rrf

    def trace(self) -> dict[str, object]:
        return {
            "chunk_id": str(self.chunk_id),
            "document_id": str(self.document_id),
            "title": self.title,
            "page": self.page_start,
            "vector_rank": self.vector_rank,
            "vector_score": None if self.vector_score is None else round(self.vector_score, 6),
            "lexical_rank": self.lexical_rank,
            "lexical_score": None if self.lexical_score is None else round(self.lexical_score, 6),
            "rrf": round(self.rrf, 6),
            "rerank_score": None if self.rerank_score is None else round(self.rerank_score, 6),
        }


@dataclass
class RetrievalResult:
    chunks: list[ScoredChunk]
    candidates: list[ScoredChunk]
    timings_ms: dict[str, float] = field(default_factory=dict)
    query_embedding: list[float] | None = None
    degraded: list[str] = field(default_factory=list)

    @property
    def reranked(self) -> bool:
        return any(c.rerank_score is not None for c in self.candidates)

    @property
    def best_score(self) -> float:
        return max((c.relevance for c in self.chunks), default=0.0)

    @property
    def best_vector_score(self) -> float:
        return max((c.vector_score or 0.0 for c in self.candidates), default=0.0)


EmbedderFor = Callable[[str], Embedder]


def rerank_input(chunk: ScoredChunk) -> str:
    path = " > ".join([chunk.title, *chunk.heading_path[1:]] if chunk.heading_path else [chunk.title])
    return f"{path}\n{chunk.text}"


async def load_chunks(session: AsyncSession, ids: list[uuid.UUID]) -> dict[uuid.UUID, ScoredChunk]:
    if not ids:
        return {}
    rows = await session.execute(
        text(
            """
            select c.id, c.document_id, c.collection_id, d.title, d.mime_type, c.text, c.heading_path,
                   c.page_start, c.page_end, c.char_start, c.char_end
            from chunks c join documents d on d.id = c.document_id
            where c.id = any(:ids) and d.status <> 'deleted'
            """
        ),
        {"ids": ids},
    )
    return {
        row.id: ScoredChunk(
            chunk_id=row.id,
            document_id=row.document_id,
            collection_id=row.collection_id,
            title=row.title,
            mime_type=row.mime_type,
            text=row.text,
            heading_path=list(row.heading_path or []),
            page_start=row.page_start,
            page_end=row.page_end,
            char_start=row.char_start,
            char_end=row.char_end,
        )
        for row in rows
    }


class Retriever:
    def __init__(
        self,
        sessions: async_sessionmaker[AsyncSession],
        embedder_for: EmbedderFor,
        reranker: Reranker | None,
    ) -> None:
        self.sessions = sessions
        self.embedder_for = embedder_for
        self.reranker = reranker

    async def _timed[T](self, timings: dict[str, float], name: str, work: Awaitable[T]) -> T:
        started = time.perf_counter()
        try:
            return await work
        finally:
            timings[name] = round((time.perf_counter() - started) * 1000, 2)

    async def _vector(
        self,
        query: str,
        allowed: dict[uuid.UUID, str],
        config: RetrievalConfig,
        timings: dict[str, float],
        holder: list[list[float]],
    ) -> list[VectorHit]:
        groups: dict[str, list[uuid.UUID]] = {}
        for collection_id, model in allowed.items():
            groups.setdefault(model, []).append(collection_id)
        hits: list[VectorHit] = []
        embed_ms = 0.0
        search_ms = 0.0
        for model, collections in sorted(groups.items()):
            started = time.perf_counter()
            async with asyncio.timeout(config.embed_timeout_s):
                embedding = await self.embedder_for(model).embed_query(query)
            embed_ms += (time.perf_counter() - started) * 1000
            if not holder:
                holder.append(embedding)
            started = time.perf_counter()
            async with self.sessions() as session, session.begin():
                hits.extend(
                    await vector_search(
                        session, embedding, collections, model, config.vector_k, config.ef_search
                    )
                )
            search_ms += (time.perf_counter() - started) * 1000
        hits.sort(key=lambda h: -h.score)
        hits = hits[: config.vector_k]
        timings["embed"] = round(embed_ms, 2)
        timings["vector"] = round(search_ms, 2)
        return [VectorHit(h.chunk_id, h.document_id, h.score, index + 1) for index, h in enumerate(hits)]

    async def _lexical(
        self, query: str, allowed: list[uuid.UUID], config: RetrievalConfig
    ) -> list[LexicalHit]:
        async with self.sessions() as session:
            return await lexical_search(session, query, allowed, config.lexical_k)

    async def retrieve(
        self, query: str, allowed: dict[uuid.UUID, str], config: RetrievalConfig | None = None
    ) -> RetrievalResult:
        cfg = config or RetrievalConfig()
        with tracer.start_as_current_span("rag.retrieve") as span:
            span.set_attribute("rag.mode", cfg.mode)
            span.set_attribute("rag.rerank", cfg.rerank)
            span.set_attribute("rag.collections", len(allowed))
            result = await self._retrieve(query, allowed, cfg)
            span.set_attribute("rag.candidates", len(result.candidates))
            span.set_attribute("rag.selected", len(result.chunks))
            for name, value in result.timings_ms.items():
                span.set_attribute(f"rag.timing.{name}_ms", value)
            return result

    async def _retrieve(
        self, query: str, allowed: dict[uuid.UUID, str], cfg: RetrievalConfig
    ) -> RetrievalResult:
        timings: dict[str, float] = {}
        if not allowed or not query.strip():
            return RetrievalResult(chunks=[], candidates=[], timings_ms=timings)
        holder: list[list[float]] = []
        vector_task: Awaitable[list[VectorHit]] | None = None
        lexical_task: Awaitable[list[LexicalHit]] | None = None
        if cfg.mode in {"vector", "hybrid"}:
            vector_task = self._vector(query, allowed, cfg, timings, holder)
        if cfg.mode in {"lexical", "hybrid"}:
            lexical_task = self._timed(timings, "lexical", self._lexical(query, list(allowed), cfg))

        async def empty_v() -> list[VectorHit]:
            return []

        async def empty_l() -> list[LexicalHit]:
            return []

        degraded: list[str] = []

        async def guarded_vector() -> list[VectorHit]:
            if vector_task is None:
                return []
            try:
                return await vector_task
            except (TimeoutError, httpx.HTTPError):
                degraded.append("embedding_unavailable")
                return []

        vec, lex = await asyncio.gather(guarded_vector(), lexical_task or empty_l())
        if "embedding_unavailable" in degraded and cfg.mode == "vector":
            lex = await self._timed(timings, "lexical", self._lexical(query, list(allowed), cfg))
        fused = rrf([vec, lex], k=cfg.rrf_k)[: cfg.fused_k]
        started = time.perf_counter()
        async with self.sessions() as session:
            loaded = await load_chunks(session, [chunk_id for chunk_id, _ in fused])
        timings["fetch"] = round((time.perf_counter() - started) * 1000, 2)
        vec_by_id = {h.chunk_id: h for h in vec}
        lex_by_id = {h.chunk_id: h for h in lex}
        candidates: list[ScoredChunk] = []
        for chunk_id, score in fused:
            chunk = loaded.get(chunk_id)
            if chunk is None or chunk.collection_id not in allowed:
                continue
            if chunk_id in vec_by_id:
                chunk.vector_rank = vec_by_id[chunk_id].rank
                chunk.vector_score = vec_by_id[chunk_id].score
            if chunk_id in lex_by_id:
                chunk.lexical_rank = lex_by_id[chunk_id].rank
                chunk.lexical_score = lex_by_id[chunk_id].score
            chunk.rrf = score
            candidates.append(chunk)
        if cfg.rerank and self.reranker is not None and candidates:
            started = time.perf_counter()
            try:
                async with asyncio.timeout(cfg.rerank_timeout_s):
                    scores = await self.reranker.rerank(query, [rerank_input(c) for c in candidates])
            except (TimeoutError, httpx.HTTPError):
                degraded.append("rerank_unavailable")
            else:
                for chunk, value in zip(candidates, scores, strict=True):
                    chunk.rerank_score = value
                candidates.sort(key=lambda c: -(c.rerank_score or 0.0))
            timings["rerank"] = round((time.perf_counter() - started) * 1000, 2)
        top = max((c.relevance for c in candidates), default=1.0) or 1.0
        selected = mmr_dedupe(
            candidates,
            relevance=lambda c: c.relevance / top,
            text_of=lambda c: c.text,
            document_of=lambda c: c.document_id,
            k=cfg.k,
            max_per_document=cfg.max_per_document,
            lambda_=cfg.mmr_lambda,
        )
        return RetrievalResult(
            chunks=selected,
            candidates=candidates,
            timings_ms=timings,
            query_embedding=holder[0] if holder else None,
            degraded=degraded,
        )
