# ADR 0005: Structure-aware chunking with a token limit and contextual prefix

Status: accepted · 2026-10-02

## Context

Fixed windows cut sentences and tables in half and lose the section context that makes a chunk citable.

## Decision

Walk parsed blocks keeping a heading stack; pack blocks up to `max_tokens` (default 450, embedding tokenizer); headings level ≤ 2 force a new chunk; long paragraphs split by sentence; tables become their own chunk; one-sentence overlap only inside a section. The embedding input is `title > heading path` + text, the stored text has no prefix (citations stay clean).

## Alternatives considered

Fixed token windows with overlap (simple, worse boundaries); semantic chunking with embeddings (expensive at ingest, non-deterministic).

## Consequences

- Property tests (Hypothesis) prove: no chunk exceeds max_tokens, no text is lost, ordinals/hashes are deterministic.
- Profiles `default` (450), `small` (250), `large` (800) exist for experiments; the contextual prefix is a measured row in the experiment table.
- Cost: the prefix changes the chunk hash, so renaming a heading re-embeds that section.
