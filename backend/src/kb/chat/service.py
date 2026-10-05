from __future__ import annotations

import time
import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime

import anyio
from fastapi import Request
from redis.exceptions import RedisError
from sqlalchemy import select, update

from kb.auth.principal import Principal
from kb.core.container import Container
from kb.core.errors import ProblemError, not_found
from kb.core.models import Collection, Conversation, Message, QueryLog
from kb.core.redis import key
from kb.core.telemetry import CHAT_REQUESTS, INFLIGHT_STREAMS, LLM_COST, LLM_TOKENS, RAG_STEP
from kb.generation.answerer import AnswerEngine, AnswerEvent, AnswerOutcome
from kb.providers.llms.base import LlmMessage
from kb.retrieval.vector import vector_literal

STEP_KEYS = (
    "acl",
    "condense",
    "embed",
    "vector",
    "lexical",
    "fetch",
    "rerank",
    "first_token",
    "generate",
    "total",
)


def sse_bytes(event: AnswerEvent) -> bytes:
    import json

    return f"event: {event.event}\ndata: {json.dumps(event.data, default=str)}\n\n".encode()


class ChatService:
    def __init__(self, container: Container) -> None:
        self.c = container

    async def conversation(self, principal: Principal, conversation_id: uuid.UUID) -> Conversation:
        async with self.c.sessions() as session:
            conversation = await session.get(Conversation, conversation_id)
        if conversation is None or conversation.user_sub != principal.sub:
            raise not_found("Conversation")
        return conversation

    async def check_limits(self, principal: Principal) -> None:
        s = self.c.settings
        minute = int(time.time() // 60)
        rl_key = key(s, "rl", "chat", principal.sub, str(minute))
        day_key = key(s, "tokens", principal.sub, datetime.now(UTC).strftime("%Y%m%d"))
        try:
            count = await self.c.redis.incr(rl_key)
            if count == 1:
                await self.c.redis.expire(rl_key, 70)
            used = int(await self.c.redis.get(day_key) or 0)
        except RedisError:
            return
        if count > s.chat_rate_limit_per_minute:
            raise ProblemError(
                429,
                "RATE_LIMITED",
                "Too many questions",
                "Chat rate limit exceeded, retry shortly",
                headers={"Retry-After": str(60 - int(time.time()) % 60)},
            )
        if used >= s.daily_token_limit:
            raise ProblemError(
                429,
                "DAILY_TOKEN_LIMIT",
                "Daily token limit reached",
                f"Daily limit of {s.daily_token_limit} tokens reached",
            )

    async def history(self, conversation_id: uuid.UUID) -> list[LlmMessage]:
        async with self.c.sessions() as session:
            rows = (
                await session.scalars(
                    select(Message)
                    .where(Message.conversation_id == conversation_id)
                    .order_by(Message.created_at.desc())
                    .limit(6)
                )
            ).all()
        return [
            LlmMessage(role="user" if m.role == "user" else "assistant", content=m.content)
            for m in reversed(rows)
        ]

    def stop_key(self, message_id: uuid.UUID) -> str:
        return key(self.c.settings, "stop", str(message_id))

    async def request_stop(self, principal: Principal, message_id: uuid.UUID) -> bool:
        owner = await self.c.redis.get(key(self.c.settings, "streaming", str(message_id)))
        if owner is None:
            async with self.c.sessions() as session:
                row = (
                    await session.execute(
                        select(Conversation.user_sub)
                        .join(Message, Message.conversation_id == Conversation.id)
                        .where(Message.id == message_id)
                    )
                ).first()
            if row is None or row[0] != principal.sub:
                raise not_found("Message")
            return False
        if owner != principal.sub:
            raise not_found("Message")
        await self.c.redis.set(self.stop_key(message_id), "1", ex=300)
        return True

    async def start(
        self,
        request: Request,
        principal: Principal,
        conversation_id: uuid.UUID,
        content: str,
        collections: list[uuid.UUID] | None,
    ) -> AsyncIterator[bytes]:
        conversation = await self.conversation(principal, conversation_id)
        await self.check_limits(principal)
        history = await self.history(conversation_id)
        user_message_id = uuid.uuid4()
        assistant_id = uuid.uuid4()
        query_log_id = uuid.uuid4()
        async with self.c.sessions() as session, session.begin():
            session.add(
                Message(
                    id=user_message_id,
                    conversation_id=conversation_id,
                    role="user",
                    content=content,
                    status="complete",
                )
            )
            values: dict[str, object] = {"updated_at": datetime.now(UTC)}
            if not conversation.title:
                values["title"] = content.strip().replace("\n", " ")[:80]
            await session.execute(
                update(Conversation).where(Conversation.id == conversation_id).values(**values)
            )
        try:
            await self.c.redis.set(
                key(self.c.settings, "streaming", str(assistant_id)), principal.sub, ex=600
            )
        except RedisError:
            pass
        return self._stream(
            request,
            principal,
            conversation_id,
            content,
            history,
            collections,
            assistant_id,
            user_message_id,
            query_log_id,
        )

    async def _stream(
        self,
        request: Request,
        principal: Principal,
        conversation_id: uuid.UUID,
        content: str,
        history: list[LlmMessage],
        collections: list[uuid.UUID] | None,
        assistant_id: uuid.UUID,
        user_message_id: uuid.UUID,
        query_log_id: uuid.UUID,
    ) -> AsyncIterator[bytes]:
        INFLIGHT_STREAMS.inc()
        outcome = AnswerOutcome(question=content)
        started = time.perf_counter()
        cancelled = False
        searched: list[dict[str, str]] = []
        try:
            acl_started = time.perf_counter()
            allowed = await self.c.access.allowed_collections(principal)
            if collections:
                wanted = set(collections)
                allowed = {cid: m for cid, m in allowed.items() if cid in wanted}
            outcome.timings_ms["acl"] = round((time.perf_counter() - acl_started) * 1000, 2)
            async with self.c.sessions() as session:
                names = (
                    (
                        await session.execute(
                            select(Collection.id, Collection.name).where(Collection.id.in_(list(allowed)))
                        )
                    ).all()
                    if allowed
                    else []
                )
            searched = [{"id": str(r.id), "name": r.name} for r in sorted(names, key=lambda r: r.name)]
            engine = AnswerEngine(self.c.retriever(), self.c.llm, self.c.condense_llm, self.c.settings)
            stop_key = self.stop_key(assistant_id)

            async def should_stop() -> bool:
                if await request.is_disconnected():
                    return True
                try:
                    return bool(await self.c.redis.get(stop_key))
                except RedisError:
                    return False

            meta_extra = {
                "query_log_id": str(query_log_id),
                "message_id": str(assistant_id),
                "user_message_id": str(user_message_id),
                "searched_collections": searched,
            }
            async for event in engine.run(
                content, history, allowed, outcome, stop=should_stop, meta_extra=meta_extra
            ):
                yield sse_bytes(event)
        except (anyio.get_cancelled_exc_class(), GeneratorExit):
            cancelled = True
            outcome.status = "stopped"
            raise
        except Exception:
            outcome.status = "error"
            outcome.outcome = "error"
            outcome.error_code = "INTERNAL"
            yield sse_bytes(AnswerEvent("error", {"code": "INTERNAL"}))
        finally:
            INFLIGHT_STREAMS.dec()
            outcome.timings_ms.setdefault("total", round((time.perf_counter() - started) * 1000, 2))
            with anyio.CancelScope(shield=True):
                await self._persist(principal, conversation_id, assistant_id, query_log_id, outcome, searched)
        if not cancelled:
            usage = outcome.usage
            yield sse_bytes(
                AnswerEvent(
                    "done",
                    {
                        "message_id": str(assistant_id),
                        "query_log_id": str(query_log_id),
                        "status": outcome.status,
                        "content": outcome.content,
                        "usage": {
                            "input_tokens": usage.input_tokens,
                            "output_tokens": usage.output_tokens,
                            "cost_usd": float(outcome.cost_usd),
                            "model": outcome.model,
                        },
                        "timings_ms": outcome.timings_ms,
                        "citations": outcome.citations,
                        "warnings": outcome.warnings,
                        "uncited_claims": outcome.uncited_claims,
                    },
                )
            )

    async def _persist(
        self,
        principal: Principal,
        conversation_id: uuid.UUID,
        assistant_id: uuid.UUID,
        query_log_id: uuid.UUID,
        outcome: AnswerOutcome,
        searched: list[dict[str, str]] | None = None,
    ) -> None:
        s = self.c.settings
        status = outcome.status
        result_outcome = outcome.outcome if status != "stopped" else "answered"
        if status == "error":
            result_outcome = "error"
        question_embedding = None
        if outcome.retrieval is not None and outcome.retrieval.query_embedding is not None:
            question_embedding = outcome.retrieval.query_embedding
        try:
            async with self.c.sessions() as session, session.begin():
                session.add(
                    QueryLog(
                        id=query_log_id,
                        user_sub=principal.sub,
                        conversation_id=conversation_id,
                        question=outcome.question if s.log_question_text else None,
                        condensed_question=outcome.condensed if s.log_question_text else None,
                        allowed_collections=None,
                        retrieved=outcome.retrieved_trace(),
                        timings_ms=outcome.timings_ms,
                        model=outcome.model,
                        prompt_version=s.prompt_version,
                        input_tokens=outcome.usage.input_tokens,
                        output_tokens=outcome.usage.output_tokens,
                        cost_usd=outcome.cost_usd,
                        outcome=result_outcome,
                        prompt=outcome.prompt if s.log_question_text else None,
                    )
                )
                await session.flush()
                if question_embedding is not None:
                    from sqlalchemy import text

                    await session.execute(
                        text("update query_logs set question_embedding = cast(:e as vector) where id = :i"),
                        {"e": vector_literal(question_embedding), "i": query_log_id},
                    )
                allowed = await self.c.access.allowed_collections(principal)
                await session.execute(
                    update(QueryLog)
                    .where(QueryLog.id == query_log_id)
                    .values(allowed_collections=list(allowed))
                )
                session.add(
                    Message(
                        id=assistant_id,
                        conversation_id=conversation_id,
                        role="assistant",
                        content=outcome.content or "",
                        citations=outcome.citations or None,
                        meta={
                            "warnings": outcome.warnings,
                            "uncited_claims": outcome.uncited_claims,
                            "condensed": outcome.condensed,
                            "best_score": round(outcome.best_score, 4),
                            "error_code": outcome.error_code,
                            "sources": outcome.sources,
                            "searched_collections": searched or [],
                            "no_answer_reason": outcome.no_answer_reason,
                        },
                        status=status,
                        query_log_id=query_log_id,
                    )
                )
        except Exception:
            return
        CHAT_REQUESTS.labels(result_outcome).inc()
        for step in STEP_KEYS:
            if step in outcome.timings_ms:
                RAG_STEP.labels(step).observe(outcome.timings_ms[step] / 1000)
        LLM_TOKENS.labels(outcome.model, "input").inc(outcome.usage.input_tokens)
        LLM_TOKENS.labels(outcome.model, "output").inc(outcome.usage.output_tokens)
        LLM_COST.labels(outcome.model).inc(float(outcome.cost_usd))
        try:
            day_key = key(s, "tokens", principal.sub, datetime.now(UTC).strftime("%Y%m%d"))
            await self.c.redis.incrby(day_key, outcome.usage.input_tokens + outcome.usage.output_tokens)
            await self.c.redis.expire(day_key, 172800)
            await self.c.redis.delete(key(s, "streaming", str(assistant_id)), self.stop_key(assistant_id))
        except RedisError:
            pass
