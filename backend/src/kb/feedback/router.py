from __future__ import annotations

import uuid

from fastapi import APIRouter, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from kb.chat.schemas import FeedbackIn, FeedbackOut
from kb.core.errors import bad_request, not_found
from kb.core.models import Conversation, Feedback, Message
from kb.core.telemetry import FEEDBACK
from kb.deps import PrincipalDep, SessionDep

router = APIRouter(tags=["feedback"])


@router.post(
    "/chat/messages/{message_id}/feedback",
    response_model=FeedbackOut,
    status_code=status.HTTP_201_CREATED,
    operation_id="sendFeedback",
)
async def send_feedback(
    message_id: uuid.UUID, body: FeedbackIn, principal: PrincipalDep, session: SessionDep
) -> FeedbackOut:
    row = (
        await session.execute(
            select(Message, Conversation.user_sub)
            .join(Conversation, Conversation.id == Message.conversation_id)
            .where(Message.id == message_id)
        )
    ).first()
    if row is None or row[1] != principal.sub:
        raise not_found("Message")
    if row[0].role != "assistant":
        raise bad_request("NOT_ASSISTANT_MESSAGE", "Feedback can only be given on assistant messages")
    stmt = insert(Feedback).values(
        id=uuid.uuid4(),
        message_id=message_id,
        user_sub=principal.sub,
        rating=body.rating,
        reason=body.reason,
        comment=body.comment,
    )
    upsert = stmt.on_conflict_do_update(
        constraint="uq_feedback_message_user",
        set_={
            "rating": stmt.excluded.rating,
            "reason": stmt.excluded.reason,
            "comment": stmt.excluded.comment,
            "created_at": stmt.excluded.created_at,
        },
    ).returning(Feedback)
    feedback = (await session.scalars(upsert)).one()
    await session.commit()
    FEEDBACK.labels("up" if body.rating > 0 else "down").inc()
    return FeedbackOut(
        id=feedback.id,
        message_id=feedback.message_id,
        rating=feedback.rating,
        reason=feedback.reason,
        comment=feedback.comment,
        created_at=feedback.created_at,
    )
