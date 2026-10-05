# ADR 0002: ACL is applied before ranking (pre-filter)

Status: accepted · 2026-10-02

## Context

Users must never see chunks from collections they cannot read. A leak through retrieval is the worst possible bug for this product.

## Decision

Compute the caller's allowed collection ids first (`AccessService`, Redis cache keyed by `sub` + hash of groups + a global grants version) and push `collection_id = any(:allowed)` into both the vector and the lexical SQL. pgvector ≥ 0.8 `hnsw.iterative_scan = relaxed_order` keeps the ANN scan going until enough filtered rows are found.

## Alternatives considered

Post-filtering the global top-k: simpler, but returns too few or zero results for small collections and leaks if anyone forgets the filter on one path.

## Consequences

- Every path that returns content (`/search`, chat sources, `/chunks/{id}`, document detail, presigned download URL) checks the ACL; 404 is returned for inaccessible resources so their existence is not disclosed.
- Leakage is measured by an independent oracle in eval (computed from `eval-data/collections.json` + `users.json`, not from the ACL code) and is a hard gate: `leakage_rate == 0`.
- Grants changes bump a version key, so cached ACL entries expire immediately instead of after 60 s.
- Trade-off: iterative scans make worst-case latency less predictable for tiny collections inside a huge index (bounded by `ef_search` and the scan limits).
