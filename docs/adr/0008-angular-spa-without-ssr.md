# ADR 0008: Angular SPA without SSR

Status: accepted · 2026-10-02

## Context

The UI lives behind a login; nothing is indexed by search engines.

## Decision

Standalone, zoneless Angular served as static files (nginx in Docker, a tiny Node server locally) with a runtime `config.json`, so one build runs against any API/IdP.

## Alternatives considered

Angular SSR: better first paint, but a Node server, token handling on the server and no SEO benefit.

## Consequences

- Heavy features (PDF viewer, charts, markdown) are lazy routes / `@defer` so the initial bundle stays under the 400 kB budget.
- Cost: first paint waits for JS + OIDC redirect; acceptable for an internal tool.
