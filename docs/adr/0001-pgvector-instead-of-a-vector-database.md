# ADR 0001: pgvector instead of a dedicated vector database

Status: accepted · 2026-10-02

## Context

Retrieval needs vector similarity, full-text search and an ACL filter over the same chunks. Expected size is well below one million chunks per deployment.

## Decision

Store embeddings in PostgreSQL with pgvector (HNSW, cosine) next to the `tsvector` column and the denormalised `collection_id`. One SQL statement applies the ACL filter and ranks; ingestion swaps chunks in one transaction.

## Alternatives considered

Qdrant / Weaviate: better filtered-ANN tooling and horizontal scaling, but a second store to keep consistent with Postgres (dual writes, no shared transaction, ACL duplicated).

## Consequences

- One backup, one transaction boundary: a document is never half-visible (incremental swap in `IngestionPipeline.finalize`).
- Vector dimension is per collection: the column is untyped `vector`, and each embedding model gets a partial expression index `hnsw ((embedding::vector(384)))` `where embedding_model = '…'` (created on collection create). Queries cast to the same expression so the planner can use it (verified by `test_vector_query_uses_partial_hnsw_index`).
- Cost: HNSW build time and memory grow with the corpus; past a few million chunks a dedicated engine or partitioning by collection would be needed.
