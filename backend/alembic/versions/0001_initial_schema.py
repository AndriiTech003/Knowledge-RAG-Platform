from __future__ import annotations

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

STATEMENTS = [
    "create extension if not exists vector",
    """
    create table collections (
      id uuid primary key,
      name text not null,
      description text,
      embedding_model text not null,
      chunking_profile text not null default 'default',
      created_by text not null,
      created_at timestamptz not null default now()
    )
    """,
    """
    create table collection_grants (
      collection_id uuid not null references collections(id) on delete cascade,
      principal_type text not null constraint ck_grants_principal_type check (principal_type in ('group','user')),
      principal_id text not null,
      role text not null constraint ck_grants_role check (role in ('viewer','editor','owner')),
      primary key (collection_id, principal_type, principal_id)
    )
    """,
    "create index ix_collection_grants_principal on collection_grants (principal_type, principal_id)",
    """
    create table sources (
      id uuid primary key,
      collection_id uuid not null references collections(id) on delete cascade,
      kind text not null constraint ck_sources_kind check (kind in ('upload','web','notion')),
      config jsonb not null,
      schedule text,
      last_synced_at timestamptz,
      status text,
      last_error text
    )
    """,
    """
    create table documents (
      id uuid primary key,
      collection_id uuid not null references collections(id) on delete cascade,
      source_id uuid references sources(id) on delete set null,
      external_id text,
      title text not null,
      mime_type text not null,
      storage_key text,
      content_hash text not null,
      page_count int,
      status text not null constraint ck_documents_status check
        (status in ('queued','parsing','chunking','embedding','ready','failed','deleted')),
      error text,
      metadata jsonb not null default '{}',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint uq_documents_collection_external unique (collection_id, external_id)
    )
    """,
    "create index ix_documents_collection_status on documents (collection_id, status)",
    """
    create table chunks (
      id uuid primary key,
      document_id uuid not null references documents(id) on delete cascade,
      collection_id uuid not null,
      ordinal int not null,
      text text not null,
      heading_path text[] not null default '{}',
      page_start int,
      page_end int,
      char_start int,
      char_end int,
      token_count int not null,
      content_hash text not null,
      embedding vector,
      embedding_model text,
      tsv tsvector generated always as (to_tsvector('english', text)) stored
    )
    """,
    "create index ix_chunks_tsv on chunks using gin (tsv)",
    "create index ix_chunks_collection_id on chunks (collection_id)",
    "create index ix_chunks_document_ordinal on chunks (document_id, ordinal)",
    "create index ix_chunks_content_hash on chunks (document_id, content_hash)",
    """
    create table conversations (
      id uuid primary key,
      user_sub text not null,
      title text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
    """,
    "create index ix_conversations_user_updated on conversations (user_sub, updated_at)",
    """
    create table messages (
      id uuid primary key,
      conversation_id uuid not null references conversations(id) on delete cascade,
      role text not null constraint ck_messages_role check (role in ('user','assistant')),
      content text not null,
      citations jsonb,
      meta jsonb,
      status text,
      query_log_id uuid,
      created_at timestamptz not null default now()
    )
    """,
    "create index ix_messages_conversation_created on messages (conversation_id, created_at)",
    """
    create table query_logs (
      id uuid primary key,
      user_sub text,
      conversation_id uuid,
      question text,
      condensed_question text,
      allowed_collections uuid[],
      retrieved jsonb,
      timings_ms jsonb,
      model text,
      prompt_version text,
      input_tokens int,
      output_tokens int,
      cost_usd numeric(10,6),
      outcome text,
      question_embedding vector,
      prompt text,
      created_at timestamptz not null default now()
    )
    """,
    "create index ix_query_logs_created on query_logs (created_at)",
    "create index ix_query_logs_outcome_created on query_logs (outcome, created_at)",
    """
    create table feedback (
      id uuid primary key,
      message_id uuid not null references messages(id) on delete cascade,
      user_sub text not null,
      rating smallint not null constraint ck_feedback_rating check (rating in (-1, 1)),
      reason text,
      comment text,
      created_at timestamptz not null default now(),
      constraint uq_feedback_message_user unique (message_id, user_sub)
    )
    """,
    """
    create table eval_runs (
      id uuid primary key,
      git_sha text,
      config jsonb not null,
      dataset_version text,
      started_at timestamptz,
      finished_at timestamptz,
      metrics jsonb,
      status text not null,
      error text
    )
    """,
    """
    create table eval_results (
      run_id uuid not null references eval_runs(id) on delete cascade,
      question_id text not null,
      question_type text,
      question text,
      retrieved_doc_ids uuid[],
      answer text,
      metrics jsonb,
      judge_rationale text,
      primary key (run_id, question_id)
    )
    """,
    """
    create table ingestion_jobs (
      id uuid primary key,
      document_id uuid,
      source_id uuid,
      kind text not null,
      status text not null,
      attempts int not null default 0,
      error text,
      started_at timestamptz,
      finished_at timestamptz,
      stats jsonb
    )
    """,
    "create index ix_ingestion_jobs_document on ingestion_jobs (document_id, started_at)",
    """
    create table staged_chunks (
      job_id uuid not null,
      ordinal int not null,
      document_id uuid not null,
      text text not null,
      heading_path text[] not null default '{}',
      page_start int,
      page_end int,
      char_start int,
      char_end int,
      token_count int not null,
      content_hash text not null,
      embed_text text not null,
      embedding vector,
      reused_chunk_id uuid,
      created_at timestamptz not null default now(),
      primary key (job_id, ordinal)
    )
    """,
    "create index ix_staged_chunks_document on staged_chunks (document_id)",
    """
    create table web_page_states (
      source_id uuid not null references sources(id) on delete cascade,
      url text not null,
      etag text,
      last_modified text,
      last_status int,
      fetched_at timestamptz,
      primary key (source_id, url)
    )
    """,
]


def upgrade() -> None:
    for statement in STATEMENTS:
        op.execute(statement)
    from kb.retrieval.vector import vector_index_ddl

    for model in ("BAAI/bge-small-en-v1.5", "hash-384"):
        op.execute(vector_index_ddl(model))


def downgrade() -> None:
    for table in (
        "staged_chunks",
        "web_page_states",
        "ingestion_jobs",
        "eval_results",
        "eval_runs",
        "feedback",
        "query_logs",
        "messages",
        "conversations",
        "chunks",
        "documents",
        "sources",
        "collection_grants",
        "collections",
    ):
        op.execute(f"drop table if exists {table} cascade")
