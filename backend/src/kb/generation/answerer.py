from __future__ import annotations

import time
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any, Protocol

from opentelemetry import trace

from kb.config import Settings, price_for
from kb.generation.citations import CitationTracker, citation_payload, source_summary
from kb.generation.guardrails import apply_guardrails
from kb.generation.prompts import answer_messages, condense_messages
from kb.providers.llms.base import LlmClient, LlmMessage, LlmUnavailableError, LlmUsage, collect
from kb.providers.rerankers.base import Reranker
from kb.retrieval.retriever import RetrievalConfig, RetrievalResult

tracer = trace.get_tracer("kb.generation")
NO_ANSWER_TEXT = "I couldn't find information about this in the documents available to you."


class RetrieverLike(Protocol):
    reranker: Reranker | None

    async def retrieve(
        self, query: str, allowed: dict[uuid.UUID, str], config: RetrievalConfig | None = None
    ) -> RetrievalResult: ...


@dataclass
class AnswerEvent:
    event: str
    data: dict[str, Any]


@dataclass
class AnswerOutcome:
    question: str
    condensed: str | None = None
    retrieval: RetrievalResult | None = None
    content: str = ""
    status: str = "complete"
    outcome: str = "answered"
    citations: list[dict[str, Any]] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    uncited_claims: list[str] = field(default_factory=list)
    usage: LlmUsage = field(default_factory=LlmUsage)
    cost_usd: Decimal = Decimal("0")
    timings_ms: dict[str, float] = field(default_factory=dict)
    prompt: str | None = None
    best_score: float = 0.0
    model: str = ""
    error_code: str | None = None
    sources: list[dict[str, Any]] = field(default_factory=list)
    no_answer_reason: str | None = None

    def retrieved_trace(self) -> list[dict[str, object]]:
        if self.retrieval is None:
            return []
        selected = {c.chunk_id for c in self.retrieval.chunks}
        trace = []
        for chunk in self.retrieval.candidates:
            item = chunk.trace()
            item["selected"] = chunk.chunk_id in selected
            trace.append(item)
        return trace


StopCheck = Callable[[], Awaitable[bool]]


def ms_since(started: float) -> float:
    return round((time.perf_counter() - started) * 1000, 2)


class AnswerEngine:
    def __init__(
        self, retriever: RetrieverLike, llm: LlmClient, condense_llm: LlmClient, settings: Settings
    ) -> None:
        self.retriever = retriever
        self.llm = llm
        self.condense_llm = condense_llm
        self.settings = settings

    def default_config(self) -> RetrievalConfig:
        s = self.settings
        return RetrievalConfig(
            k=s.final_top_k,
            vector_k=s.vector_top_k,
            lexical_k=s.lexical_top_k,
            fused_k=s.fused_top_k,
            rrf_k=s.rrf_k,
            max_per_document=s.max_chunks_per_document,
            mmr_lambda=s.mmr_lambda,
            ef_search=s.hnsw_ef_search,
            embed_timeout_s=s.embed_timeout_seconds,
            rerank_timeout_s=s.rerank_timeout_seconds,
            rerank=self.retriever.reranker is not None,
        )

    def is_low_relevance(
        self, result: RetrievalResult, config: RetrievalConfig, threshold: float | None
    ) -> bool:
        if not result.chunks:
            return True
        if config.rerank and self.retriever.reranker is not None and result.reranked:
            tau = self.settings.no_answer_threshold if threshold is None else threshold
            return result.best_score < tau
        if config.mode in {"vector", "hybrid"}:
            return result.best_vector_score < self.settings.no_answer_vector_threshold
        return False

    async def condense(self, question: str, history: list[LlmMessage]) -> tuple[str | None, LlmUsage]:
        if not history:
            return None, LlmUsage()
        system, messages = condense_messages(history, question, self.settings.prompt_version)
        result = await self.condense_llm.complete(system, messages, 200)
        text = " ".join(result.text.split()).strip().strip('"')
        return (text or None), result.usage

    async def run(
        self,
        question: str,
        history: list[LlmMessage],
        allowed: dict[uuid.UUID, str],
        outcome: AnswerOutcome,
        config: RetrievalConfig | None = None,
        threshold: float | None = None,
        stop: StopCheck | None = None,
        meta_extra: dict[str, Any] | None = None,
    ) -> AsyncIterator[AnswerEvent]:
        cfg = config or self.default_config()
        started = time.perf_counter()
        outcome.model = self.llm.model
        usage = LlmUsage()
        try:
            t0 = time.perf_counter()
            condensed, condense_usage = await self.condense(question, history)
            if history:
                outcome.timings_ms["condense"] = ms_since(t0)
            usage.input_tokens += condense_usage.input_tokens
            usage.output_tokens += condense_usage.output_tokens
        except LlmUnavailableError:
            condensed = None
        outcome.condensed = condensed
        search_query = condensed or question
        result = await self.retriever.retrieve(search_query, allowed, cfg)
        outcome.retrieval = result
        outcome.timings_ms.update(result.timings_ms)
        outcome.best_score = result.best_score if result.reranked else result.best_vector_score
        chunks = result.chunks
        sources = [source_summary(n, c) for n, c in enumerate(chunks, start=1)]
        low = self.is_low_relevance(result, cfg, threshold)
        meta: dict[str, Any] = {
            "condensed": condensed,
            "sources": [] if low else sources,
            "degraded": result.degraded,
        }
        meta.update(meta_extra or {})
        outcome.sources = [] if low else sources
        yield AnswerEvent("meta", meta)
        if low:
            outcome.status = "no_answer"
            outcome.outcome = "no_answer"
            outcome.content = NO_ANSWER_TEXT
            reason = "no_access" if not allowed else "low_relevance"
            outcome.no_answer_reason = reason
            yield AnswerEvent("no_answer", {"reason": reason, "best_score": round(outcome.best_score, 4)})
            outcome.timings_ms["total"] = ms_since(started)
            outcome.usage = usage
            outcome.cost_usd = self.cost(usage)
            return
        span = tracer.start_span(
            "rag.generate", attributes={"llm.model": self.llm.model, "rag.sources": len(chunks)}
        )
        system, messages = answer_messages(search_query, chunks, self.settings.prompt_version)
        outcome.prompt = system + "\n\n" + messages[-1].content
        tracker = CitationTracker(len(chunks))
        parts: list[str] = []
        gen_started = time.perf_counter()
        stopped = False
        try:
            stream = self.llm.stream(system, messages, self.settings.llm_max_output_tokens)
            try:
                async for chunk in stream:
                    if chunk.usage is not None:
                        usage.input_tokens += chunk.usage.input_tokens
                        usage.output_tokens += chunk.usage.output_tokens
                    if chunk.text:
                        if "first_token" not in outcome.timings_ms:
                            outcome.timings_ms["first_token"] = ms_since(started)
                        parts.append(chunk.text)
                        yield AnswerEvent("token", {"t": chunk.text})
                        for n in tracker.feed(chunk.text):
                            yield AnswerEvent("citation", {"n": n})
                    if stop is not None and await stop():
                        stopped = True
                        break
            finally:
                closer = getattr(stream, "aclose", None)
                if closer is not None:
                    await closer()
        except LlmUnavailableError:
            outcome.status = "error"
            outcome.outcome = "error"
            outcome.error_code = "LLM_UNAVAILABLE"
            outcome.content = "".join(parts)
            outcome.timings_ms["total"] = ms_since(started)
            outcome.usage = usage
            outcome.cost_usd = self.cost(usage)
            yield AnswerEvent("error", {"code": "LLM_UNAVAILABLE"})
            return
        raw = "".join(parts)
        source_texts = [c.text for c in chunks]
        guarded = apply_guardrails(raw, source_texts)
        if guarded.retry and not stopped:
            retry = await collect(self.llm.stream(system, messages, self.settings.llm_max_output_tokens))
            usage.input_tokens += retry.usage.input_tokens
            usage.output_tokens += retry.usage.output_tokens
            guarded = apply_guardrails(retry.text, source_texts)
            guarded.warnings.append("retried_short_answer")
        outcome.timings_ms["generate"] = ms_since(gen_started)
        outcome.timings_ms["total"] = ms_since(started)
        outcome.content = guarded.text
        outcome.warnings = [*guarded.warnings, *result.degraded]
        outcome.uncited_claims = guarded.uncited_claims
        outcome.citations = [
            citation_payload(n, chunks[n - 1]) for n in guarded.cited if 1 <= n <= len(chunks)
        ]
        outcome.usage = usage
        outcome.cost_usd = self.cost(usage)
        outcome.status = "stopped" if stopped else "complete"
        span.set_attribute("llm.input_tokens", usage.input_tokens)
        span.set_attribute("llm.output_tokens", usage.output_tokens)
        span.set_attribute("rag.status", outcome.status)
        span.end()

    def cost(self, usage: LlmUsage) -> Decimal:
        price = price_for(self.llm.model)
        value = (
            Decimal(usage.input_tokens) * price.input_per_mtok
            + Decimal(usage.output_tokens) * price.output_per_mtok
        ) / Decimal(1_000_000)
        return value.quantize(Decimal("0.000001"))
