# ADR 0011: Incremental indexing by content hashes

Status: accepted · 2026-10-02

## Context

Re-embedding whole documents on every change wastes time and money and makes syncs slow.

## Decision

Hash the normalised parsed document (plus chunking profile and embedding model): unchanged → skip. Otherwise re-chunk and compare chunk hashes: identical chunks keep their embedding (and id), new ones are embedded in batches on the `embed` queue, removed ones are deleted — all swapped in one transaction (`finalize`).

## Alternatives considered

Full reindex on every change.

## Consequences

- The UI shows `chunks_new / chunks_unchanged / chunks_deleted` per ingestion job.
- Changing a collection's embedding model reindexes with a short vector-search gap for that collection (lexical search keeps working). The correct zero-downtime path — a second embedding column filled in the background and an atomic switch — is described but not implemented.
