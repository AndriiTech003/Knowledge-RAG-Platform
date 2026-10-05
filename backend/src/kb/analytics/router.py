from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Query

from kb.analytics import service
from kb.analytics.schemas import (
    NegativeFeedbackItem,
    Overview,
    QueryLogSummary,
    QueryTrace,
    UnansweredCluster,
)
from kb.core.errors import not_found
from kb.deps import AdminDep, ContainerDep

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/analytics/overview", response_model=Overview, operation_id="analyticsOverview")
async def analytics_overview(
    _admin: AdminDep,
    container: ContainerDep,
    from_: Annotated[datetime | None, Query(alias="from")] = None,
    to: datetime | None = None,
) -> dict[str, Any]:
    return await service.overview(container, from_, to)


@router.get(
    "/analytics/unanswered", response_model=list[UnansweredCluster], operation_id="analyticsUnanswered"
)
async def analytics_unanswered(
    _admin: AdminDep, container: ContainerDep, fresh: bool = False
) -> list[dict[str, Any]]:
    return await service.unanswered(container, fresh)


@router.get(
    "/analytics/negative-feedback",
    response_model=list[NegativeFeedbackItem],
    operation_id="analyticsNegativeFeedback",
)
async def analytics_negative_feedback(
    _admin: AdminDep,
    container: ContainerDep,
    cursor: datetime | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[dict[str, Any]]:
    return await service.negative_feedback(container, limit, cursor)


@router.get("/query-logs", response_model=list[QueryLogSummary], operation_id="listQueryLogs")
async def list_query_logs(
    _admin: AdminDep,
    container: ContainerDep,
    outcome: str | None = None,
    cursor: datetime | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[dict[str, Any]]:
    return await service.query_logs(container, outcome, limit, cursor)


@router.get("/query-logs/{query_log_id}", response_model=QueryTrace, operation_id="getQueryLog")
async def get_query_log(query_log_id: uuid.UUID, _admin: AdminDep, container: ContainerDep) -> dict[str, Any]:
    trace = await service.query_trace(container, query_log_id)
    if trace is None:
        raise not_found("Query log")
    return trace
