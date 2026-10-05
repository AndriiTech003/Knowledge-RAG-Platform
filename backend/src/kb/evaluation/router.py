from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Query, status
from pydantic import BaseModel
from sqlalchemy import select

from kb.core.errors import not_found
from kb.core.models import EvalResult, EvalRun
from kb.deps import AdminDep, SessionDep
from kb.documents.dispatch import enqueue_eval
from kb.evaluation.runner import EvalConfig
from kb.retrieval.retriever import RetrievalConfig

router = APIRouter(prefix="/admin/eval", tags=["eval"])
HEADLINE = ("recall@8", "mrr", "leakage_rate", "no_answer_accuracy", "correctness", "faithfulness")


class EvalRunOut(BaseModel):
    id: uuid.UUID
    git_sha: str | None
    config: dict[str, Any]
    dataset_version: str | None
    started_at: datetime | None
    finished_at: datetime | None
    metrics: dict[str, Any] | None
    status: str
    error: str | None
    deltas: dict[str, float] = {}


class EvalResultOut(BaseModel):
    question_id: str
    question_type: str | None
    question: str | None
    retrieved_doc_ids: list[uuid.UUID]
    answer: str | None
    metrics: dict[str, Any] | None
    judge_rationale: str | None


class EvalRunDetail(EvalRunOut):
    results: list[EvalResultOut]


class EvalRunCreate(BaseModel):
    mode: Literal["retrieval", "full"] = "retrieval"
    name: str | None = None
    retrieval_mode: Literal["vector", "lexical", "hybrid"] = "hybrid"
    rerank: bool = True
    k: int = 8
    limit: int | None = None


class CompareRow(BaseModel):
    question_id: str
    question_type: str | None
    question: str | None
    a: dict[str, Any] | None
    b: dict[str, Any] | None
    change: Literal["improved", "worse", "unchanged", "new", "removed"]
    delta: float | None


class CompareOut(BaseModel):
    a: EvalRunOut
    b: EvalRunOut
    summary: dict[str, int]
    deltas: dict[str, float]
    rows: list[CompareRow]


def run_out(run: EvalRun, previous: EvalRun | None = None) -> EvalRunOut:
    deltas: dict[str, float] = {}
    if previous is not None and run.metrics and previous.metrics:
        for name in HEADLINE:
            a, b = run.metrics.get(name), previous.metrics.get(name)
            if isinstance(a, int | float) and isinstance(b, int | float):
                deltas[name] = round(float(a) - float(b), 4)
    return EvalRunOut(
        id=run.id,
        git_sha=run.git_sha,
        config=run.config,
        dataset_version=run.dataset_version,
        started_at=run.started_at,
        finished_at=run.finished_at,
        metrics=run.metrics,
        status=run.status,
        error=run.error,
        deltas=deltas,
    )


def score(metrics: dict[str, Any] | None) -> float | None:
    if not metrics:
        return None
    parts: list[float] = []
    for name in ("recall@8", "correctness", "faithfulness"):
        value = metrics.get(name)
        if isinstance(value, int | float):
            parts.append(float(value) / (5.0 if name == "correctness" else 1.0))
    if isinstance(metrics.get("no_answer_correct"), bool):
        parts.append(1.0 if metrics["no_answer_correct"] else 0.0)
    return round(sum(parts) / len(parts), 4) if parts else None


@router.get("/runs", response_model=list[EvalRunOut], operation_id="listEvalRuns")
async def list_runs(
    _admin: AdminDep, session: SessionDep, limit: Annotated[int, Query(ge=1, le=200)] = 50
) -> list[EvalRunOut]:
    runs = list(
        (
            await session.scalars(
                select(EvalRun).order_by(EvalRun.started_at.desc().nulls_last()).limit(limit + 1)
            )
        ).all()
    )
    out = []
    for index, run in enumerate(runs[:limit]):
        previous = next(
            (
                r
                for r in runs[index + 1 :]
                if r.status == "done" and (r.config or {}).get("mode") == (run.config or {}).get("mode")
            ),
            None,
        )
        out.append(run_out(run, previous))
    return out


@router.post(
    "/runs", response_model=EvalRunOut, status_code=status.HTTP_202_ACCEPTED, operation_id="startEvalRun"
)
async def start_run(body: EvalRunCreate, _admin: AdminDep, session: SessionDep) -> EvalRunOut:
    retrieval = RetrievalConfig(mode=body.retrieval_mode, rerank=body.rerank, k=body.k)
    name = body.name or f"{body.retrieval_mode}{'+rerank' if body.rerank else ''}"
    config = EvalConfig(name=name, mode=body.mode, retrieval=retrieval, limit=body.limit)
    run = EvalRun(id=uuid.uuid4(), config=config.model_dump(), status="queued", started_at=datetime.now(UTC))
    session.add(run)
    await session.commit()
    await session.refresh(run)
    enqueue_eval(run.id)
    return run_out(run)


async def _run(session: SessionDep, run_id: uuid.UUID) -> EvalRun:
    run = await session.get(EvalRun, run_id)
    if run is None:
        raise not_found("Eval run")
    return run


async def _results(session: SessionDep, run_id: uuid.UUID) -> list[EvalResult]:
    return list(
        (
            await session.scalars(
                select(EvalResult).where(EvalResult.run_id == run_id).order_by(EvalResult.question_id)
            )
        ).all()
    )


def result_out(r: EvalResult) -> EvalResultOut:
    return EvalResultOut(
        question_id=r.question_id,
        question_type=r.question_type,
        question=r.question,
        retrieved_doc_ids=list(r.retrieved_doc_ids or []),
        answer=r.answer,
        metrics=r.metrics,
        judge_rationale=r.judge_rationale,
    )


@router.get("/runs/{run_id}", response_model=EvalRunDetail, operation_id="getEvalRun")
async def get_run(run_id: uuid.UUID, _admin: AdminDep, session: SessionDep) -> EvalRunDetail:
    run = await _run(session, run_id)
    results = await _results(session, run_id)
    return EvalRunDetail(**run_out(run).model_dump(), results=[result_out(r) for r in results])


@router.get("/compare", response_model=CompareOut, operation_id="compareEvalRuns")
async def compare(a: uuid.UUID, b: uuid.UUID, _admin: AdminDep, session: SessionDep) -> CompareOut:
    run_a, run_b = await _run(session, a), await _run(session, b)
    results_a = {r.question_id: r for r in await _results(session, a)}
    results_b = {r.question_id: r for r in await _results(session, b)}
    rows: list[CompareRow] = []
    summary = {"improved": 0, "worse": 0, "unchanged": 0, "new": 0, "removed": 0}
    for qid in sorted(set(results_a) | set(results_b)):
        ra, rb = results_a.get(qid), results_b.get(qid)
        sa, sb = score(ra.metrics if ra else None), score(rb.metrics if rb else None)
        change: Literal["improved", "worse", "unchanged", "new", "removed"]
        delta: float | None = None
        if ra is None:
            change = "new"
        elif rb is None:
            change = "removed"
        else:
            delta = round((sb or 0.0) - (sa or 0.0), 4)
            change = "improved" if delta > 0.001 else "worse" if delta < -0.001 else "unchanged"
        summary[change] += 1
        ref = rb or ra
        assert ref is not None
        rows.append(
            CompareRow(
                question_id=qid,
                question_type=ref.question_type,
                question=ref.question,
                a=ra.metrics if ra else None,
                b=rb.metrics if rb else None,
                change=change,
                delta=delta,
            )
        )
    out_a, out_b = run_out(run_a), run_out(run_b, run_a)
    return CompareOut(a=out_a, b=out_b, summary=summary, deltas=out_b.deltas, rows=rows)
