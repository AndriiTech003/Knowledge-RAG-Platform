from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import numpy as np
from redis.exceptions import RedisError
from sqlalchemy import text

from kb.core.container import Container
from kb.core.db import rowcount
from kb.core.redis import key
from kb.core.text import content_terms

CLUSTER_SIMILARITY = 0.72
CLUSTER_JACCARD = 0.5


def _window(start: datetime | None, end: datetime | None) -> tuple[datetime, datetime]:
    finish = end or datetime.now(UTC)
    begin = start or finish - timedelta(days=30)
    return begin, finish


async def overview(container: Container, start: datetime | None, end: datetime | None) -> dict[str, Any]:
    begin, finish = _window(start, end)
    params = {"s": begin, "e": finish}
    async with container.sessions() as session:
        totals = (
            await session.execute(
                text(
                    """
                    select count(*) as questions,
                      count(distinct user_sub) as users,
                      count(*) filter (where outcome = 'no_answer') as no_answer,
                      count(*) filter (where outcome = 'error') as errors,
                      coalesce(sum(cost_usd), 0) as cost,
                      coalesce(sum(input_tokens), 0) as input_tokens,
                      coalesce(sum(output_tokens), 0) as output_tokens,
                      percentile_cont(0.5) within group (order by (timings_ms->>'total')::float) as p50,
                      percentile_cont(0.95) within group (order by (timings_ms->>'total')::float) as p95,
                      percentile_cont(0.5) within group (order by (timings_ms->>'first_token')::float) as ft50,
                      percentile_cont(0.95) within group (order by (timings_ms->>'first_token')::float) as ft95
                    from query_logs where created_at between :s and :e
                    """
                ),
                params,
            )
        ).one()
        feedback = (
            await session.execute(
                text(
                    """
                    select count(*) filter (where rating = 1) as up, count(*) filter (where rating = -1) as down
                    from feedback where created_at between :s and :e
                    """
                ),
                params,
            )
        ).one()
        daily = (
            await session.execute(
                text(
                    """
                    select date_trunc('day', created_at) as day, count(*) as questions,
                      count(*) filter (where outcome = 'no_answer') as no_answer,
                      count(distinct user_sub) as users,
                      percentile_cont(0.95) within group (order by (timings_ms->>'total')::float) as p95,
                      coalesce(sum(cost_usd), 0) as cost
                    from query_logs where created_at between :s and :e
                    group by 1 order by 1
                    """
                ),
                params,
            )
        ).all()
        steps = (
            await session.execute(
                text(
                    """
                    select key, percentile_cont(0.5) within group (order by value::float) as p50,
                      percentile_cont(0.95) within group (order by value::float) as p95
                    from query_logs, jsonb_each_text(timings_ms)
                    where created_at between :s and :e group by key order by key
                    """
                ),
                params,
            )
        ).all()
    questions = int(totals.questions or 0)
    return {
        "from": begin.isoformat(),
        "to": finish.isoformat(),
        "questions": questions,
        "active_users": int(totals.users or 0),
        "no_answer": int(totals.no_answer or 0),
        "no_answer_rate": round((totals.no_answer or 0) / questions, 4) if questions else 0.0,
        "errors": int(totals.errors or 0),
        "feedback_up": int(feedback.up or 0),
        "feedback_down": int(feedback.down or 0),
        "latency_ms": {"p50": _num(totals.p50), "p95": _num(totals.p95)},
        "first_token_ms": {"p50": _num(totals.ft50), "p95": _num(totals.ft95)},
        "cost_usd": float(totals.cost or 0),
        "cost_per_question_usd": round(float(totals.cost or 0) / questions, 6) if questions else 0.0,
        "tokens": {"input": int(totals.input_tokens or 0), "output": int(totals.output_tokens or 0)},
        "daily": [
            {
                "day": r.day.date().isoformat(),
                "questions": int(r.questions),
                "no_answer": int(r.no_answer),
                "users": int(r.users),
                "p95_ms": _num(r.p95),
                "cost_usd": float(r.cost),
            }
            for r in daily
        ],
        "steps_ms": {r.key: {"p50": _num(r.p50), "p95": _num(r.p95)} for r in steps},
    }


def _num(value: object) -> float | None:
    if value is None:
        return None
    return round(float(str(value)), 2)


def _parse_vector(raw: object) -> np.ndarray[Any, np.dtype[np.float64]] | None:
    if raw is None:
        return None
    if not isinstance(raw, str):
        return None
    values = [float(x) for x in raw.strip("[]").split(",") if x]
    if not values:
        return None
    vector = np.asarray(values, dtype=np.float64)
    norm = float(np.linalg.norm(vector))
    return vector / norm if norm else None


async def compute_unanswered_clusters(container: Container, days: int = 30) -> list[dict[str, Any]]:
    since = datetime.now(UTC) - timedelta(days=days)
    async with container.sessions() as session:
        rows = (
            await session.execute(
                text(
                    """
                    select id, user_sub, coalesce(condensed_question, question) as question, created_at,
                      question_embedding::text as embedding
                    from query_logs
                    where outcome = 'no_answer' and created_at >= :s and question is not null
                    order by created_at desc limit 2000
                    """
                ),
                {"s": since},
            )
        ).all()
    clusters: list[dict[str, Any]] = []
    centroids: list[np.ndarray[Any, np.dtype[np.float64]]] = []
    term_sets: list[set[str]] = []
    for row in rows:
        vector = _parse_vector(row.embedding)
        terms = set(content_terms(str(row.question)))
        target = -1
        lexical = -1
        for index, existing in enumerate(term_sets):
            union = terms | existing
            if union and len(terms & existing) / len(union) >= CLUSTER_JACCARD:
                lexical = index
                break
        if lexical >= 0:
            target = lexical
        elif vector is not None:
            best = 0.0
            for index, centroid in enumerate(centroids):
                if centroid.shape != vector.shape:
                    continue
                similarity = float(centroid @ vector)
                if similarity > best:
                    best, target = similarity, index
            if best < CLUSTER_SIMILARITY:
                target = -1
        item = {
            "query_log_id": str(row.id),
            "question": row.question,
            "user": row.user_sub,
            "created_at": row.created_at.isoformat(),
        }
        if target < 0:
            clusters.append(
                {
                    "key": " ".join(str(row.question).lower().split()),
                    "label": row.question,
                    "count": 1,
                    "users": {row.user_sub},
                    "last_seen": row.created_at.isoformat(),
                    "questions": [item],
                }
            )
            centroids.append(vector if vector is not None else np.zeros(1))
            term_sets.append(terms)
        else:
            cluster = clusters[target]
            cluster["count"] += 1
            cluster["users"].add(row.user_sub)
            if len(cluster["questions"]) < 20:
                cluster["questions"].append(item)
            if vector is not None and centroids[target].shape == vector.shape:
                merged = centroids[target] * (cluster["count"] - 1) + vector
                centroids[target] = merged / float(np.linalg.norm(merged))
    result = []
    for cluster in sorted(clusters, key=lambda c: (-int(c["count"]), str(c["label"]))):
        result.append(
            {
                "id": str(uuid.uuid5(uuid.NAMESPACE_URL, str(cluster["key"]))),
                "label": cluster["label"],
                "count": cluster["count"],
                "users": len(cluster["users"]),
                "last_seen": cluster["last_seen"],
                "questions": cluster["questions"],
            }
        )
    return result


async def refresh_unanswered_clusters(container: Container) -> int:
    clusters = await compute_unanswered_clusters(container)
    try:
        await container.redis.set(
            key(container.settings, "analytics", "unanswered"), json.dumps(clusters), ex=900
        )
    except RedisError:
        pass
    return len(clusters)


async def unanswered(container: Container, fresh: bool = False) -> list[dict[str, Any]]:
    if not fresh:
        try:
            cached = await container.redis.get(key(container.settings, "analytics", "unanswered"))
        except RedisError:
            cached = None
        if cached:
            data = json.loads(cached)
            if isinstance(data, list):
                return data
    clusters = await compute_unanswered_clusters(container)
    try:
        await container.redis.set(
            key(container.settings, "analytics", "unanswered"), json.dumps(clusters), ex=60
        )
    except RedisError:
        pass
    return clusters


async def negative_feedback(
    container: Container, limit: int, cursor: datetime | None
) -> list[dict[str, Any]]:
    async with container.sessions() as session:
        rows = (
            await session.execute(
                text(
                    """
                    select f.id, f.reason, f.comment, f.created_at, f.user_sub, m.id as message_id,
                      m.content as answer, m.citations, q.id as query_log_id, q.question, q.condensed_question,
                      q.retrieved, q.outcome
                    from feedback f join messages m on m.id = f.message_id
                    left join query_logs q on q.id = m.query_log_id
                    where f.rating = -1 and (cast(:c as timestamptz) is null or f.created_at < cast(:c as timestamptz))
                    order by f.created_at desc limit :l
                    """
                ),
                {"c": cursor, "l": limit},
            )
        ).all()
    return [
        {
            "id": str(r.id),
            "reason": r.reason,
            "comment": r.comment,
            "created_at": r.created_at.isoformat(),
            "user": r.user_sub,
            "message_id": str(r.message_id),
            "answer": r.answer,
            "citations": r.citations or [],
            "query_log_id": str(r.query_log_id) if r.query_log_id else None,
            "question": r.question,
            "condensed_question": r.condensed_question,
            "outcome": r.outcome,
            "retrieved": [c for c in (r.retrieved or []) if c.get("selected")],
        }
        for r in rows
    ]


async def query_logs(
    container: Container, outcome: str | None, limit: int, cursor: datetime | None
) -> list[dict[str, Any]]:
    async with container.sessions() as session:
        rows = (
            await session.execute(
                text(
                    """
                    select id, user_sub, question, condensed_question, outcome, timings_ms, model, cost_usd,
                      input_tokens, output_tokens, created_at
                    from query_logs
                    where (cast(:o as text) is null or outcome = cast(:o as text))
                      and (cast(:c as timestamptz) is null or created_at < cast(:c as timestamptz))
                    order by created_at desc limit :l
                    """
                ),
                {"o": outcome, "c": cursor, "l": limit},
            )
        ).all()
    return [
        {
            "id": str(r.id),
            "user": r.user_sub,
            "question": r.question,
            "condensed_question": r.condensed_question,
            "outcome": r.outcome,
            "timings_ms": r.timings_ms or {},
            "model": r.model,
            "cost_usd": float(r.cost_usd or 0),
            "input_tokens": r.input_tokens,
            "output_tokens": r.output_tokens,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]


async def query_trace(container: Container, query_log_id: uuid.UUID) -> dict[str, Any] | None:
    async with container.sessions() as session:
        row = (
            await session.execute(
                text(
                    """
                    select q.*, m.id as message_id, m.content as answer, m.citations, m.status as message_status,
                      m.meta as message_meta
                    from query_logs q left join messages m on m.query_log_id = q.id
                    where q.id = :i
                    """
                ),
                {"i": query_log_id},
            )
        ).first()
        if row is None:
            return None
        names = {}
        if row.allowed_collections:
            rows = await session.execute(
                text("select id, name from collections where id = any(:ids)"),
                {"ids": list(row.allowed_collections)},
            )
            names = {str(r.id): r.name for r in rows}
    return {
        "id": str(row.id),
        "user": row.user_sub,
        "conversation_id": str(row.conversation_id) if row.conversation_id else None,
        "question": row.question,
        "condensed_question": row.condensed_question,
        "allowed_collections": [
            {"id": str(c), "name": names.get(str(c), "")} for c in (row.allowed_collections or [])
        ],
        "retrieved": row.retrieved or [],
        "timings_ms": row.timings_ms or {},
        "model": row.model,
        "prompt_version": row.prompt_version,
        "input_tokens": row.input_tokens,
        "output_tokens": row.output_tokens,
        "cost_usd": float(row.cost_usd or 0),
        "outcome": row.outcome,
        "prompt": row.prompt,
        "created_at": row.created_at.isoformat(),
        "message_id": str(row.message_id) if row.message_id else None,
        "answer": row.answer,
        "citations": row.citations or [],
        "message_status": row.message_status,
        "message_meta": row.message_meta or {},
    }


async def cleanup_stale(container: Container) -> dict[str, int]:
    async with container.sessions() as session, session.begin():
        staged = await session.execute(
            text("delete from staged_chunks where created_at < now() - interval '1 day'")
        )
        jobs = await session.execute(
            text(
                """
                update ingestion_jobs set status = 'failed', error = 'stale', finished_at = now()
                where status = 'running' and started_at < now() - interval '2 hours'
                """
            )
        )
    return {"staged": int(rowcount(staged) or 0), "jobs": int(rowcount(jobs) or 0)}
