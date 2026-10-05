from __future__ import annotations

import time
import uuid
from collections import defaultdict
from datetime import UTC, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field
from sqlalchemy import text, update

from kb.config import Settings
from kb.core.container import Container
from kb.core.models import EvalResult, EvalRun
from kb.evaluation.dataset import Dataset, GoldenQuestion, load_dataset
from kb.evaluation.judge import FakeJudge, Judge, LlmJudge, Verdict, is_refusal
from kb.evaluation.metrics import (
    RankedChunk,
    Relevant,
    avg,
    leaked,
    matches,
    ndcg_at_k,
    percentile,
    recall_at_k,
    reciprocal_rank,
)
from kb.evaluation.source_hash import source_tree_hash
from kb.generation.answerer import AnswerEngine, AnswerOutcome
from kb.providers.llms import FakeLlm, LlmClient, build_llm
from kb.providers.llms.base import LlmMessage
from kb.retrieval.retriever import RetrievalConfig, RetrievalResult

ANSWERABLE = {"factoid", "multi_hop", "table", "exact_term", "follow_up", "conflicting", "injection"}


class EvalConfig(BaseModel):
    name: str = "hybrid+rerank"
    mode: Literal["retrieval", "full"] = "retrieval"
    retrieval: RetrievalConfig = Field(default_factory=RetrievalConfig)
    chunking_profile: str = "default"
    contextual_prefix: bool = True
    threshold: float | None = None
    embedding_model: str | None = None
    llm_provider: Literal["fake", "anthropic", "openai"] = "fake"
    llm_model: str | None = None
    judge_provider: Literal["fake", "anthropic", "openai"] = "fake"
    judge_model: str | None = None
    limit: int | None = None
    judge_stability: bool = True


class QuestionResult(BaseModel):
    id: str
    type: str
    user: str
    question: str
    expected: str
    predicted_no_answer: bool
    retrieved_doc_ids: list[str]
    retrieved_docs: list[str]
    metrics: dict[str, float | int | bool | None]
    answer: str | None = None
    rationale: str | None = None


class EvalReport(BaseModel):
    config: EvalConfig
    dataset_version: str
    started_at: str
    finished_at: str
    metrics: dict[str, Any]
    by_type: dict[str, dict[str, Any]]
    results: list[QuestionResult]


def build_judge(settings: Settings, config: EvalConfig) -> Judge:
    if config.judge_provider == "fake":
        return FakeJudge()
    llm = build_llm(
        settings, config.judge_model or settings.judge_model, provider=config.judge_provider, slot=2
    )
    return LlmJudge(llm, settings.prompt_version)


def build_answer_llm(settings: Settings, config: EvalConfig) -> LlmClient:
    if config.llm_provider == "fake":
        return FakeLlm(config.llm_model or "fake-llm")
    return build_llm(settings, config.llm_model or settings.llm_model, provider=config.llm_provider)


async def corpus_documents(container: Container) -> dict[str, tuple[uuid.UUID, uuid.UUID]]:
    async with container.sessions() as session:
        rows = await session.execute(
            text(
                """
                select id, collection_id, metadata->>'corpus_path' as path from documents
                where status = 'ready' and metadata ? 'corpus_path'
                """
            )
        )
        return {str(r.path): (r.id, r.collection_id) for r in rows}


async def collection_ids_by_slug(container: Container, dataset: Dataset) -> dict[str, uuid.UUID]:
    names = {c.name: c.slug for c in dataset.collections}
    async with container.sessions() as session:
        rows = await session.execute(text("select id, name from collections"))
        return {names[r.name]: r.id for r in rows if r.name in names}


def _ranked(result: RetrievalResult) -> list[RankedChunk]:
    return [RankedChunk(c.document_id, c.collection_id, c.page_start, c.page_end) for c in result.chunks]


def _all(result: RetrievalResult) -> list[RankedChunk]:
    return [RankedChunk(c.document_id, c.collection_id, c.page_start, c.page_end) for c in result.candidates]


async def evaluate(
    container: Container,
    dataset: Dataset,
    config: EvalConfig,
    progress: bool = False,
) -> EvalReport:
    started = datetime.now(UTC)
    settings = container.settings
    docs = await corpus_documents(container)
    by_slug = await collection_ids_by_slug(container, dataset)
    path_by_doc = {v[0]: k for k, v in docs.items()}
    answer_llm = build_answer_llm(settings, config)
    condense_llm: LlmClient = FakeLlm("fake-llm") if config.llm_provider == "fake" else container.condense_llm
    engine = AnswerEngine(container.retriever(), answer_llm, condense_llm, settings)
    judge = build_judge(settings, config) if config.mode == "full" else None
    retrieval_cfg = config.retrieval.model_copy()
    if container.reranker is None:
        retrieval_cfg.rerank = False
    questions = dataset.questions[: config.limit] if config.limit else dataset.questions
    results: list[QuestionResult] = []
    verdicts: list[tuple[GoldenQuestion, AnswerOutcome, Verdict, list[str]]] = []
    latencies: list[float] = []
    first_tokens: list[float] = []
    costs: list[float] = []
    for index, question in enumerate(questions, start=1):
        principal = dataset.principal(question.user, settings.admin_group)
        allowed = await container.access.allowed_collections(principal)
        readable = {
            by_slug[s] for s in dataset.readable_slugs(question.user, settings.admin_group) if s in by_slug
        }
        known = set(by_slug.values())
        history = [LlmMessage(role=h.role, content=h.content) for h in question.history]
        outcome = AnswerOutcome(question=question.question)
        q_started = time.perf_counter()
        if config.mode == "full":
            async for _event in engine.run(
                question.question, history, allowed, outcome, retrieval_cfg, config.threshold
            ):
                pass
            result = outcome.retrieval or RetrievalResult(chunks=[], candidates=[])
            predicted_no_answer = outcome.outcome == "no_answer" or is_refusal(outcome.content)
            if "first_token" in outcome.timings_ms:
                first_tokens.append(outcome.timings_ms["first_token"])
            costs.append(float(outcome.cost_usd))
        else:
            condensed, _usage = await engine.condense(question.question, history)
            result = await engine.retriever.retrieve(condensed or question.question, allowed, retrieval_cfg)
            outcome.retrieval = result
            outcome.condensed = condensed
            predicted_no_answer = engine.is_low_relevance(result, retrieval_cfg, config.threshold)
        elapsed = (time.perf_counter() - q_started) * 1000
        latencies.append(elapsed)
        ranked = _ranked(result)
        relevant = [
            Relevant(docs[item.doc][0], tuple(item.pages) if item.pages else None)
            for item in question.relevant
            if item.doc in docs
        ]
        missing_docs = [item.doc for item in question.relevant if item.doc not in docs]
        metrics: dict[str, float | int | bool | None] = {
            "leak": leaked([c for c in _all(result) if c.collection_id in known], readable),
            "unjudged_chunks": sum(1 for c in _all(result) if c.collection_id not in known),
            "no_answer_correct": predicted_no_answer == (question.expected == "no_answer"),
            "latency_ms": round(elapsed, 2),
            "best_score": round(result.best_score if retrieval_cfg.rerank else result.best_vector_score, 4),
            "missing_docs": len(missing_docs),
        }
        if question.expected == "answer" and relevant:
            metrics["recall@5"] = recall_at_k(ranked, relevant, 5)
            metrics["recall@8"] = recall_at_k(ranked, relevant, 8)
            metrics["mrr"] = reciprocal_rank(ranked, relevant)
            metrics["ndcg@8"] = ndcg_at_k(ranked, relevant, 8)
        answer_text: str | None = None
        rationale: str | None = None
        if config.mode == "full" and judge is not None:
            answer_text = outcome.content
            cited = [c for c in outcome.citations if isinstance(c, dict)]
            chunk_by_id = {str(c.chunk_id): c for c in result.chunks}
            cited_texts = [chunk_by_id[c["chunk_id"]].text for c in cited if c.get("chunk_id") in chunk_by_id]
            if question.forbidden:
                lowered = (answer_text or "").lower()
                metrics["injection_resisted"] = not any(f.lower() in lowered for f in question.forbidden)
            if question.expected == "answer":
                verdict = await judge.judge(
                    question.question, question.reference_answer, question.key_facts, answer_text, cited_texts
                )
                metrics["correctness"] = verdict.correctness
                metrics["faithfulness"] = verdict.faithfulness
                rationale = verdict.rationale
                verdicts.append((question, outcome, verdict, cited_texts))
                if relevant and cited:
                    good = 0
                    for c in cited:
                        chunk = chunk_by_id.get(c.get("chunk_id", ""))
                        if chunk is not None and any(
                            matches(
                                RankedChunk(
                                    chunk.document_id, chunk.collection_id, chunk.page_start, chunk.page_end
                                ),
                                Relevant(item.document_id, None),
                            )
                            for item in relevant
                        ):
                            good += 1
                    metrics["citation_precision"] = good / len(cited)
                metrics["citations"] = len(cited)
            metrics["first_token_ms"] = outcome.timings_ms.get("first_token")
            metrics["cost_usd"] = float(outcome.cost_usd)
        results.append(
            QuestionResult(
                id=question.id,
                type=question.type,
                user=question.user,
                question=question.question,
                expected=question.expected,
                predicted_no_answer=predicted_no_answer,
                retrieved_doc_ids=[str(c.document_id) for c in result.chunks],
                retrieved_docs=[path_by_doc.get(c.document_id, str(c.document_id)) for c in result.chunks],
                metrics=metrics,
                answer=answer_text,
                rationale=rationale,
            )
        )
        if progress and index % 10 == 0:
            print(f"  {index}/{len(questions)} questions", flush=True)
    stability: float | None = None
    if config.mode == "full" and judge is not None and config.judge_stability and verdicts:
        agree = 0
        for question, outcome, verdict, cited_texts in verdicts:
            second = await judge.judge(
                question.question, question.reference_answer, question.key_facts, outcome.content, cited_texts
            )
            if (
                second.correctness == verdict.correctness
                and abs(second.faithfulness - verdict.faithfulness) <= 0.1
            ):
                agree += 1
        stability = round(agree / len(verdicts), 4)
    aggregate = aggregate_metrics(results, latencies, first_tokens, costs, config.mode)
    if stability is not None:
        aggregate["judge_agreement"] = stability
    aggregate["judge"] = judge.name if judge is not None else None
    by_type: dict[str, dict[str, Any]] = {}
    grouped: dict[str, list[QuestionResult]] = defaultdict(list)
    for r in results:
        grouped[r.type].append(r)
    for kind, items in sorted(grouped.items()):
        by_type[kind] = aggregate_metrics(
            items, [float(i.metrics["latency_ms"] or 0) for i in items], [], [], config.mode
        )
    return EvalReport(
        config=config,
        dataset_version=dataset.version,
        started_at=started.isoformat(),
        finished_at=datetime.now(UTC).isoformat(),
        metrics=aggregate,
        by_type=by_type,
        results=results,
    )


def _values(results: list[QuestionResult], name: str) -> list[float]:
    out: list[float] = []
    for r in results:
        value = r.metrics.get(name)
        if value is None:
            continue
        out.append(float(value))
    return out


def aggregate_metrics(
    results: list[QuestionResult],
    latencies: list[float],
    first_tokens: list[float],
    costs: list[float],
    mode: str,
) -> dict[str, Any]:
    leak_values = _values(results, "leak")
    data: dict[str, Any] = {
        "questions": len(results),
        "retrieval_questions": len(_values(results, "recall@8")),
        "recall@5": avg(_values(results, "recall@5")),
        "recall@8": avg(_values(results, "recall@8")),
        "mrr": avg(_values(results, "mrr")),
        "ndcg@8": avg(_values(results, "ndcg@8")),
        "leakage_rate": round(sum(leak_values) / len(leak_values), 4) if leak_values else 0.0,
        "leaks": int(sum(leak_values)),
        "no_answer_accuracy": avg(_values(results, "no_answer_correct")),
        "p50_latency_ms": percentile(latencies, 0.5),
        "p95_latency_ms": percentile(latencies, 0.95),
    }
    if mode == "full":
        data.update(
            {
                "correctness": avg(_values(results, "correctness")),
                "faithfulness": avg(_values(results, "faithfulness")),
                "citation_precision": avg(_values(results, "citation_precision")),
                "injection_resisted": avg(_values(results, "injection_resisted")),
                "p50_first_token_ms": percentile(first_tokens, 0.5),
                "p95_first_token_ms": percentile(first_tokens, 0.95),
                "cost_per_question_usd": round(sum(costs) / len(costs), 6) if costs else None,
            }
        )
    return data


async def store_report(
    container: Container, report: EvalReport, git_sha: str | None, run_id: uuid.UUID | None = None
) -> uuid.UUID:
    identifier = run_id or uuid.uuid4()
    config = report.config.model_dump()
    async with container.sessions() as session, session.begin():
        existing = await session.get(EvalRun, identifier)
        if existing is None:
            session.add(
                EvalRun(
                    id=identifier,
                    git_sha=git_sha,
                    config=config,
                    dataset_version=report.dataset_version,
                    started_at=datetime.fromisoformat(report.started_at),
                    status="running",
                )
            )
            await session.flush()
        await session.execute(
            update(EvalRun)
            .where(EvalRun.id == identifier)
            .values(
                git_sha=git_sha or (existing.git_sha if existing else None),
                dataset_version=report.dataset_version,
                finished_at=datetime.fromisoformat(report.finished_at),
                metrics={**report.metrics, "by_type": report.by_type},
                status="done",
                error=None,
            )
        )
        await session.execute(text("delete from eval_results where run_id = :r"), {"r": identifier})
        for r in report.results:
            session.add(
                EvalResult(
                    run_id=identifier,
                    question_id=r.id,
                    question_type=r.type,
                    question=r.question,
                    retrieved_doc_ids=[uuid.UUID(d) for d in r.retrieved_doc_ids],
                    answer=r.answer,
                    metrics={
                        **r.metrics,
                        "user": r.user,
                        "expected": r.expected,
                        "predicted_no_answer": r.predicted_no_answer,
                        "retrieved_docs": r.retrieved_docs,
                    },
                    judge_rationale=r.rationale,
                )
            )
    return identifier


async def execute_run(container: Container, run_id: uuid.UUID) -> dict[str, Any]:
    async with container.sessions() as session:
        run = await session.get(EvalRun, run_id)
        if run is None:
            return {"status": "missing"}
        config = EvalConfig.model_validate(run.config)
    async with container.sessions() as session, session.begin():
        await session.execute(
            update(EvalRun).where(EvalRun.id == run_id).values(status="running", started_at=datetime.now(UTC))
        )
    try:
        dataset = load_dataset()
        report = await evaluate(container, dataset, config)
        await store_report(container, report, source_tree_hash(), run_id)
    except Exception as exc:
        async with container.sessions() as session, session.begin():
            await session.execute(
                update(EvalRun)
                .where(EvalRun.id == run_id)
                .values(status="failed", error=str(exc)[:2000], finished_at=datetime.now(UTC))
            )
        raise
    return {"run_id": str(run_id), "metrics": report.metrics}
