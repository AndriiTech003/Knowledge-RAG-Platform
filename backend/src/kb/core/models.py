from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, ClassVar

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    ARRAY,
    CheckConstraint,
    Computed,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    PrimaryKeyConstraint,
    SmallInteger,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    type_annotation_map: ClassVar[dict[Any, Any]] = {
        dict[str, Any]: JSONB,
        list[Any]: JSONB,
        uuid.UUID: UUID(as_uuid=True),
        datetime: DateTime(timezone=True),
    }


def new_id() -> uuid.UUID:
    return uuid.uuid4()


class Collection(Base):
    __tablename__ = "collections"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    embedding_model: Mapped[str] = mapped_column(Text)
    chunking_profile: Mapped[str] = mapped_column(Text, server_default="default")
    created_by: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class CollectionGrant(Base):
    __tablename__ = "collection_grants"
    __table_args__ = (
        PrimaryKeyConstraint("collection_id", "principal_type", "principal_id"),
        CheckConstraint("principal_type in ('group','user')", name="ck_grants_principal_type"),
        CheckConstraint("role in ('viewer','editor','owner')", name="ck_grants_role"),
    )
    collection_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("collections.id", ondelete="CASCADE"))
    principal_type: Mapped[str] = mapped_column(Text)
    principal_id: Mapped[str] = mapped_column(Text)
    role: Mapped[str] = mapped_column(Text)


class Source(Base):
    __tablename__ = "sources"
    __table_args__ = (CheckConstraint("kind in ('upload','web','notion')", name="ck_sources_kind"),)
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_id)
    collection_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("collections.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(Text)
    config: Mapped[dict[str, Any]] = mapped_column()
    schedule: Mapped[str | None] = mapped_column(Text)
    last_synced_at: Mapped[datetime | None] = mapped_column()
    status: Mapped[str | None] = mapped_column(Text)
    last_error: Mapped[str | None] = mapped_column(Text)


DOCUMENT_STATUSES = ("queued", "parsing", "chunking", "embedding", "ready", "failed", "deleted")


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (
        UniqueConstraint("collection_id", "external_id", name="uq_documents_collection_external"),
        CheckConstraint(
            "status in ('queued','parsing','chunking','embedding','ready','failed','deleted')",
            name="ck_documents_status",
        ),
        Index("ix_documents_collection_status", "collection_id", "status"),
    )
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_id)
    collection_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("collections.id", ondelete="CASCADE"))
    source_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("sources.id", ondelete="SET NULL"))
    external_id: Mapped[str | None] = mapped_column(Text)
    title: Mapped[str] = mapped_column(Text)
    mime_type: Mapped[str] = mapped_column(Text)
    storage_key: Mapped[str | None] = mapped_column(Text)
    content_hash: Mapped[str] = mapped_column(Text)
    page_count: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(Text)
    error: Mapped[str | None] = mapped_column(Text)
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", server_default="{}")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())


class Chunk(Base):
    __tablename__ = "chunks"
    __table_args__ = (
        Index("ix_chunks_tsv", "tsv", postgresql_using="gin"),
        Index("ix_chunks_collection_id", "collection_id"),
        Index("ix_chunks_document_ordinal", "document_id", "ordinal"),
    )
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_id)
    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"))
    collection_id: Mapped[uuid.UUID] = mapped_column()
    ordinal: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
    heading_path: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default="{}")
    page_start: Mapped[int | None] = mapped_column(Integer)
    page_end: Mapped[int | None] = mapped_column(Integer)
    char_start: Mapped[int | None] = mapped_column(Integer)
    char_end: Mapped[int | None] = mapped_column(Integer)
    token_count: Mapped[int] = mapped_column(Integer)
    content_hash: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list[float] | None] = mapped_column(Vector())
    embedding_model: Mapped[str | None] = mapped_column(Text)
    tsv: Mapped[str] = mapped_column(TSVECTOR, Computed("to_tsvector('english', text)", persisted=True))


class Conversation(Base):
    __tablename__ = "conversations"
    __table_args__ = (Index("ix_conversations_user_updated", "user_sub", "updated_at"),)
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_id)
    user_sub: Mapped[str] = mapped_column(Text)
    title: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        CheckConstraint("role in ('user','assistant')", name="ck_messages_role"),
        Index("ix_messages_conversation_created", "conversation_id", "created_at"),
    )
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_id)
    conversation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(Text)
    content: Mapped[str] = mapped_column(Text)
    citations: Mapped[list[Any] | None] = mapped_column()
    meta: Mapped[dict[str, Any] | None] = mapped_column()
    status: Mapped[str | None] = mapped_column(Text)
    query_log_id: Mapped[uuid.UUID | None] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class QueryLog(Base):
    __tablename__ = "query_logs"
    __table_args__ = (Index("ix_query_logs_created", "created_at"),)
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_id)
    user_sub: Mapped[str | None] = mapped_column(Text)
    conversation_id: Mapped[uuid.UUID | None] = mapped_column()
    question: Mapped[str | None] = mapped_column(Text)
    condensed_question: Mapped[str | None] = mapped_column(Text)
    allowed_collections: Mapped[list[uuid.UUID] | None] = mapped_column(ARRAY(UUID(as_uuid=True)))
    retrieved: Mapped[list[Any] | None] = mapped_column()
    timings_ms: Mapped[dict[str, Any] | None] = mapped_column()
    model: Mapped[str | None] = mapped_column(Text)
    prompt_version: Mapped[str | None] = mapped_column(Text)
    input_tokens: Mapped[int | None] = mapped_column(Integer)
    output_tokens: Mapped[int | None] = mapped_column(Integer)
    cost_usd: Mapped[Decimal | None] = mapped_column(Numeric(10, 6))
    outcome: Mapped[str | None] = mapped_column(Text)
    question_embedding: Mapped[list[float] | None] = mapped_column(Vector())
    prompt: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class Feedback(Base):
    __tablename__ = "feedback"
    __table_args__ = (
        CheckConstraint("rating in (-1, 1)", name="ck_feedback_rating"),
        UniqueConstraint("message_id", "user_sub", name="uq_feedback_message_user"),
    )
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_id)
    message_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("messages.id", ondelete="CASCADE"))
    user_sub: Mapped[str] = mapped_column(Text)
    rating: Mapped[int] = mapped_column(SmallInteger)
    reason: Mapped[str | None] = mapped_column(Text)
    comment: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class EvalRun(Base):
    __tablename__ = "eval_runs"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_id)
    git_sha: Mapped[str | None] = mapped_column(Text)
    config: Mapped[dict[str, Any]] = mapped_column()
    dataset_version: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column()
    finished_at: Mapped[datetime | None] = mapped_column()
    metrics: Mapped[dict[str, Any] | None] = mapped_column()
    status: Mapped[str] = mapped_column(Text)
    error: Mapped[str | None] = mapped_column(Text)


class EvalResult(Base):
    __tablename__ = "eval_results"
    __table_args__ = (PrimaryKeyConstraint("run_id", "question_id"),)
    run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("eval_runs.id", ondelete="CASCADE"))
    question_id: Mapped[str] = mapped_column(Text)
    question_type: Mapped[str | None] = mapped_column(Text)
    question: Mapped[str | None] = mapped_column(Text)
    retrieved_doc_ids: Mapped[list[uuid.UUID] | None] = mapped_column(ARRAY(UUID(as_uuid=True)))
    answer: Mapped[str | None] = mapped_column(Text)
    metrics: Mapped[dict[str, Any] | None] = mapped_column()
    judge_rationale: Mapped[str | None] = mapped_column(Text)


class IngestionJob(Base):
    __tablename__ = "ingestion_jobs"
    __table_args__ = (Index("ix_ingestion_jobs_document", "document_id", "started_at"),)
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_id)
    document_id: Mapped[uuid.UUID | None] = mapped_column()
    source_id: Mapped[uuid.UUID | None] = mapped_column()
    kind: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text)
    attempts: Mapped[int] = mapped_column(Integer, server_default="0")
    error: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column()
    finished_at: Mapped[datetime | None] = mapped_column()
    stats: Mapped[dict[str, Any] | None] = mapped_column()


class WebPageState(Base):
    __tablename__ = "web_page_states"
    __table_args__ = (PrimaryKeyConstraint("source_id", "url"),)
    source_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sources.id", ondelete="CASCADE"))
    url: Mapped[str] = mapped_column(Text)
    etag: Mapped[str | None] = mapped_column(Text)
    last_modified: Mapped[str | None] = mapped_column(Text)
    last_status: Mapped[int | None] = mapped_column(Integer)
    fetched_at: Mapped[datetime | None] = mapped_column()


class StagedChunk(Base):
    __tablename__ = "staged_chunks"
    __table_args__ = (
        PrimaryKeyConstraint("job_id", "ordinal"),
        Index("ix_staged_chunks_document", "document_id"),
    )
    job_id: Mapped[uuid.UUID] = mapped_column()
    ordinal: Mapped[int] = mapped_column(Integer)
    document_id: Mapped[uuid.UUID] = mapped_column()
    text: Mapped[str] = mapped_column(Text)
    heading_path: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default="{}")
    page_start: Mapped[int | None] = mapped_column(Integer)
    page_end: Mapped[int | None] = mapped_column(Integer)
    char_start: Mapped[int | None] = mapped_column(Integer)
    char_end: Mapped[int | None] = mapped_column(Integer)
    token_count: Mapped[int] = mapped_column(Integer)
    content_hash: Mapped[str] = mapped_column(Text)
    embed_text: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list[float] | None] = mapped_column(Vector())
    reused_chunk_id: Mapped[uuid.UUID | None] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
