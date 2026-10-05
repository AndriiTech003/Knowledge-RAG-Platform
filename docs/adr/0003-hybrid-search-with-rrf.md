# ADR 0003: Hybrid retrieval: vector + Postgres FTS fused with RRF

Status: accepted · 2026-10-02

## Context

Embeddings miss exact identifiers (policy numbers like POL-SEC-014, error codes NW-E4012, RFC ids) and rare names; BM25-style search misses paraphrases.

## Decision

Run vector top-40 and lexical top-40 (`websearch_to_tsquery` over OR-ed content terms, `ts_rank_cd`) in parallel, fuse with Reciprocal Rank Fusion (k = 60), keep top-30 for reranking.

## Alternatives considered

Vector only (fewer moving parts); weighted score fusion (needs score calibration across two incomparable scales).

## Consequences

- RRF needs no score normalisation and is robust to one list being empty.
- Measured on the golden set (see the experiment table in README.public.md): hybrid raised recall@8 over the vector-only configuration; the exact_term subset is where lexical matters most.
- Cost: two queries per question and an extra GIN index; English stemming only (`to_tsvector('english', …)`).
