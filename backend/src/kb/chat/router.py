from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Query, Request, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, or_, select

from kb.chat.schemas import (
    ConversationCreate,
    ConversationOut,
    ConversationPatch,
    MessageCreate,
    MessageFeedback,
    MessageOut,
)
from kb.chat.service import ChatService
from kb.core.errors import not_found
from kb.core.models import Conversation, Feedback, Message
from kb.core.pagination import Page, decode_cursor, encode_cursor
from kb.deps import ContainerDep, PrincipalDep, SessionDep
from kb.documents.router import SSE_HEADERS

router = APIRouter(prefix="/chat", tags=["chat"])


def conversation_out(c: Conversation) -> ConversationOut:
    return ConversationOut(id=c.id, title=c.title, created_at=c.created_at, updated_at=c.updated_at)


def message_out(m: Message) -> MessageOut:
    return MessageOut(
        id=m.id,
        conversation_id=m.conversation_id,
        role="user" if m.role == "user" else "assistant",
        content=m.content,
        citations=m.citations,
        meta=m.meta,
        status=m.status,
        query_log_id=m.query_log_id,
        created_at=m.created_at,
    )


async def owned(session: SessionDep, principal_sub: str, conversation_id: uuid.UUID) -> Conversation:
    conversation = await session.get(Conversation, conversation_id)
    if conversation is None or conversation.user_sub != principal_sub:
        raise not_found("Conversation")
    return conversation


@router.get("/conversations", response_model=Page[ConversationOut], operation_id="listConversations")
async def list_conversations(
    principal: PrincipalDep,
    session: SessionDep,
    q: str | None = None,
    cursor: str | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> Page[ConversationOut]:
    query = select(Conversation).where(Conversation.user_sub == principal.sub)
    if q:
        query = query.where(Conversation.title.ilike(f"%{q.replace('%', '')}%"))
    decoded = decode_cursor(cursor)
    if decoded:
        ts = datetime.fromisoformat(str(decoded["updated_at"]))
        cid = uuid.UUID(str(decoded["id"]))
        query = query.where(
            or_(Conversation.updated_at < ts, (Conversation.updated_at == ts) & (Conversation.id < cid))
        )
    rows = list(
        (
            await session.scalars(
                query.order_by(Conversation.updated_at.desc(), Conversation.id.desc()).limit(limit + 1)
            )
        ).all()
    )
    next_cursor = None
    if len(rows) > limit:
        last = rows[limit - 1]
        next_cursor = encode_cursor({"updated_at": last.updated_at, "id": str(last.id)})
    return Page[ConversationOut](items=[conversation_out(c) for c in rows[:limit]], next_cursor=next_cursor)


@router.post(
    "/conversations",
    response_model=ConversationOut,
    status_code=status.HTTP_201_CREATED,
    operation_id="createConversation",
)
async def create_conversation(
    body: ConversationCreate, principal: PrincipalDep, session: SessionDep
) -> ConversationOut:
    conversation = Conversation(id=uuid.uuid4(), user_sub=principal.sub, title=body.title)
    session.add(conversation)
    await session.commit()
    await session.refresh(conversation)
    return conversation_out(conversation)


@router.get(
    "/conversations/{conversation_id}", response_model=ConversationOut, operation_id="getConversation"
)
async def get_conversation(
    conversation_id: uuid.UUID, principal: PrincipalDep, session: SessionDep
) -> ConversationOut:
    return conversation_out(await owned(session, principal.sub, conversation_id))


@router.patch(
    "/conversations/{conversation_id}", response_model=ConversationOut, operation_id="renameConversation"
)
async def patch_conversation(
    conversation_id: uuid.UUID, body: ConversationPatch, principal: PrincipalDep, session: SessionDep
) -> ConversationOut:
    conversation = await owned(session, principal.sub, conversation_id)
    conversation.title = body.title
    await session.commit()
    await session.refresh(conversation)
    return conversation_out(conversation)


@router.delete(
    "/conversations/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="deleteConversation",
)
async def delete_conversation(
    conversation_id: uuid.UUID, principal: PrincipalDep, session: SessionDep
) -> Response:
    await owned(session, principal.sub, conversation_id)
    await session.execute(delete(Conversation).where(Conversation.id == conversation_id))
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/conversations/{conversation_id}/messages", response_model=Page[MessageOut], operation_id="listMessages"
)
async def list_messages(
    conversation_id: uuid.UUID,
    principal: PrincipalDep,
    session: SessionDep,
    cursor: str | None = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 200,
) -> Page[MessageOut]:
    await owned(session, principal.sub, conversation_id)
    query = select(Message).where(Message.conversation_id == conversation_id)
    decoded = decode_cursor(cursor)
    if decoded:
        ts = datetime.fromisoformat(str(decoded["created_at"]))
        mid = uuid.UUID(str(decoded["id"]))
        query = query.where(or_(Message.created_at > ts, (Message.created_at == ts) & (Message.id > mid)))
    rows = list(
        (await session.scalars(query.order_by(Message.created_at, Message.id).limit(limit + 1))).all()
    )
    next_cursor = None
    if len(rows) > limit:
        last = rows[limit - 1]
        next_cursor = encode_cursor({"created_at": last.created_at, "id": str(last.id)})
    given = {
        f.message_id: f
        for f in (
            await session.scalars(
                select(Feedback).where(
                    Feedback.message_id.in_([m.id for m in rows]), Feedback.user_sub == principal.sub
                )
            )
        ).all()
    }
    items = []
    for m in rows[:limit]:
        out = message_out(m)
        if m.id in given:
            f = given[m.id]
            out.feedback = MessageFeedback(rating=f.rating, reason=f.reason, comment=f.comment)
        items.append(out)
    return Page[MessageOut](items=items, next_cursor=next_cursor)


@router.post(
    "/conversations/{conversation_id}/messages",
    operation_id="sendMessage",
    response_class=StreamingResponse,
    responses={
        200: {
            "content": {"text/event-stream": {}},
            "description": "SSE stream: meta, token, citation, no_answer, done, error",
        }
    },
)
async def send_message(
    conversation_id: uuid.UUID,
    body: MessageCreate,
    request: Request,
    principal: PrincipalDep,
    container: ContainerDep,
) -> StreamingResponse:
    stream = await ChatService(container).start(
        request, principal, conversation_id, body.content, body.collections
    )
    return StreamingResponse(stream, media_type="text/event-stream", headers=SSE_HEADERS)


@router.post("/messages/{message_id}/stop", status_code=status.HTTP_202_ACCEPTED, operation_id="stopMessage")
async def stop_message(
    message_id: uuid.UUID, principal: PrincipalDep, container: ContainerDep
) -> dict[str, bool]:
    stopped = await ChatService(container).request_stop(principal, message_id)
    return {"stopping": stopped}
