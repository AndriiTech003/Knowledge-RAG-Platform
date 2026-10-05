# ADR 0007: OIDC with Keycloak, groups from the token

Status: accepted · 2026-10-02

## Context

The product is an internal tool for companies that already have an IdP; permissions are group based.

## Decision

Keycloak realm `northwind` (exported in `infra/keycloak/realm-northwind.json`), public client `kb-web` with Authorization Code + PKCE (S256), a group-membership mapper (`groups` claim) and an audience mapper (`kb-api`). The API validates RS256 tokens against the JWKS (cached, refreshed on unknown `kid`), checking `iss`, `aud`, `exp`.

## Alternatives considered

Own username/password auth: not what an enterprise buyer wants and not the point of this project.

## Consequences

- Group names are read without paths (`/finance` → `finance`); `kb-admins` is the admin group.
- Direct grant is enabled on the dev client only so scripts (smoke, Locust) can obtain tokens; a production realm would disable it.
- Algorithm-confusion and key-rotation cases are unit tested.
