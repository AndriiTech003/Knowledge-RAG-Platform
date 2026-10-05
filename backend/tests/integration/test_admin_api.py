from __future__ import annotations

import uuid
from collections.abc import Callable
from typing import Any

import pytest
from httpx import AsyncClient

from kb.core.container import Container
from kb.evaluation.runner import execute_run
from tests.integration.helpers import standard_setup
from tests.support import parse_sse


@pytest.fixture
async def ids(clean: None, container: Container) -> dict[str, uuid.UUID]:
    return await standard_setup(container)


async def ask(client: AsyncClient, headers: dict[str, str], question: str) -> dict[str, Any]:
    conversation = (await client.post("/api/v1/chat/conversations", headers=headers, json={})).json()["id"]
    response = await client.post(
        f"/api/v1/chat/conversations/{conversation}/messages", headers=headers, json={"content": question}
    )
    return parse_sse(response.text)[-1][1]


async def test_admin_endpoints_require_kb_admins(
    client: AsyncClient, ids: dict[str, uuid.UUID], auth: Callable[..., dict[str, str]]
) -> None:
    for path in (
        "/api/v1/admin/analytics/overview",
        "/api/v1/admin/analytics/unanswered",
        "/api/v1/admin/analytics/negative-feedback",
        "/api/v1/admin/query-logs",
        "/api/v1/admin/eval/runs",
    ):
        assert (await client.get(path, headers=auth("carol"))).status_code == 403, path
        assert (await client.get(path, headers=auth("admin"))).status_code == 200, path


async def test_overview_unanswered_negative_feedback_and_trace(
    client: AsyncClient, ids: dict[str, uuid.UUID], auth: Callable[..., dict[str, str]]
) -> None:
    answered = await ask(client, auth("carol"), "What was the approved marketing budget for Q3?")
    for question in (
        "Can I bring my dog to the Mars office?",
        "Is my dog allowed in the Mars office?",
        "What is the parking fee for spaceships?",
    ):
        await ask(client, auth("alice"), question)
    await client.post(
        f"/api/v1/chat/messages/{answered['message_id']}/feedback",
        headers=auth("carol"),
        json={"rating": -1, "reason": "outdated", "comment": "old numbers"},
    )
    admin = auth("admin")
    overview = (await client.get("/api/v1/admin/analytics/overview", headers=admin)).json()
    assert overview["questions"] == 4
    assert overview["active_users"] == 2
    assert overview["no_answer"] == 3
    assert overview["no_answer_rate"] == 0.75
    assert overview["feedback_down"] == 1
    assert overview["latency_ms"]["p95"] is not None
    assert overview["cost_usd"] > 0
    assert "rerank" in overview["steps_ms"]
    assert overview["daily"][0]["questions"] == 4
    assert "from" in overview
    clusters = (await client.get("/api/v1/admin/analytics/unanswered?fresh=true", headers=admin)).json()
    assert sum(c["count"] for c in clusters) == 3
    assert clusters[0]["count"] == 2
    assert "Mars office" in clusters[0]["label"]
    negative = (await client.get("/api/v1/admin/analytics/negative-feedback", headers=admin)).json()
    assert negative[0]["reason"] == "outdated"
    assert negative[0]["question"] == "What was the approved marketing budget for Q3?"
    assert negative[0]["retrieved"]
    logs = (await client.get("/api/v1/admin/query-logs?outcome=answered", headers=admin)).json()
    assert len(logs) == 1
    trace = (await client.get(f"/api/v1/admin/query-logs/{answered['query_log_id']}", headers=admin)).json()
    assert trace["answer"] == answered["content"]
    assert trace["prompt"].count("<source n=") >= 1
    assert {"acl", "embed", "vector", "lexical", "rerank", "first_token", "total"} <= set(trace["timings_ms"])
    selected = [r for r in trace["retrieved"] if r["selected"]]
    assert selected[0]["rerank_score"] is not None
    assert any(c["name"] == "Finance" for c in trace["allowed_collections"])
    assert (await client.get(f"/api/v1/admin/query-logs/{uuid.uuid4()}", headers=admin)).status_code == 404


async def test_eval_run_lifecycle_and_compare(
    client: AsyncClient,
    ids: dict[str, uuid.UUID],
    auth: Callable[..., dict[str, str]],
    container: Container,
    dispatched: list[tuple[str, uuid.UUID]],
) -> None:
    admin = auth("admin")
    runs = []
    for body in ({"mode": "retrieval", "limit": 6}, {"mode": "retrieval", "rerank": False, "limit": 6}):
        created = await client.post("/api/v1/admin/eval/runs", headers=admin, json=body)
        assert created.status_code == 202
        assert created.json()["status"] == "queued"
        run_id = uuid.UUID(created.json()["id"])
        assert dispatched[-1] == ("eval", run_id)
        result = await execute_run(container, run_id)
        assert "metrics" in result
        runs.append(run_id)
    listing = (await client.get("/api/v1/admin/eval/runs", headers=admin)).json()
    assert [r["status"] for r in listing[:2]] == ["done", "done"]
    detail = (await client.get(f"/api/v1/admin/eval/runs/{runs[0]}", headers=admin)).json()
    assert len(detail["results"]) == 6
    assert detail["metrics"]["leakage_rate"] == 0
    compare = (await client.get(f"/api/v1/admin/eval/compare?a={runs[0]}&b={runs[1]}", headers=admin)).json()
    assert sum(compare["summary"].values()) == 6
    assert {r["change"] for r in compare["rows"]} <= {"improved", "worse", "unchanged"}
