from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class Percentiles(BaseModel):
    p50: float | None
    p95: float | None


class TokenTotals(BaseModel):
    input: int
    output: int


class DailyPoint(BaseModel):
    day: str
    questions: int
    no_answer: int
    users: int
    p95_ms: float | None
    cost_usd: float


class Overview(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    from_: str = Field(alias="from")
    to: str
    questions: int
    active_users: int
    no_answer: int
    no_answer_rate: float
    errors: int
    feedback_up: int
    feedback_down: int
    latency_ms: Percentiles
    first_token_ms: Percentiles
    cost_usd: float
    cost_per_question_usd: float
    tokens: TokenTotals
    daily: list[DailyPoint]
    steps_ms: dict[str, Percentiles]


class ClusterQuestion(BaseModel):
    query_log_id: str
    question: str | None
    user: str | None
    created_at: str


class UnansweredCluster(BaseModel):
    id: str
    label: str | None
    count: int
    users: int
    last_seen: str
    questions: list[ClusterQuestion]


class RetrievedCandidate(BaseModel):
    chunk_id: str
    document_id: str
    title: str
    page: int | None = None
    vector_rank: int | None = None
    vector_score: float | None = None
    lexical_rank: int | None = None
    lexical_score: float | None = None
    rrf: float
    rerank_score: float | None = None
    selected: bool = False


class NegativeFeedbackItem(BaseModel):
    id: str
    reason: str | None
    comment: str | None
    created_at: str
    user: str | None
    message_id: str
    answer: str | None
    citations: list[dict[str, Any]]
    query_log_id: str | None
    question: str | None
    condensed_question: str | None
    outcome: str | None
    retrieved: list[RetrievedCandidate]


class QueryLogSummary(BaseModel):
    id: str
    user: str | None
    question: str | None
    condensed_question: str | None
    outcome: str | None
    timings_ms: dict[str, float]
    model: str | None
    cost_usd: float
    input_tokens: int | None
    output_tokens: int | None
    created_at: str


class CollectionRef(BaseModel):
    id: str
    name: str


class QueryTrace(BaseModel):
    id: str
    user: str | None
    conversation_id: str | None
    question: str | None
    condensed_question: str | None
    allowed_collections: list[CollectionRef]
    retrieved: list[RetrievedCandidate]
    timings_ms: dict[str, float]
    model: str | None
    prompt_version: str | None
    input_tokens: int | None
    output_tokens: int | None
    cost_usd: float
    outcome: str | None
    prompt: str | None
    created_at: str
    message_id: str | None
    answer: str | None
    citations: list[dict[str, Any]]
    message_status: str | None
    message_meta: dict[str, Any]
