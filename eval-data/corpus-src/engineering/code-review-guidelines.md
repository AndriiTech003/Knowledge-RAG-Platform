---
title: Code Review Guidelines
format: md
author: Lukas Brandt
updated: 2026-02-17
---
# Code Review Guidelines

**Owner:** Engineering Leadership · **Last updated:** 17 February 2026

Code review at Northwind Labs exists to catch defects early, spread knowledge across teams and keep the codebase consistent. These guidelines apply to all repositories in the `northwind-labs` GitHub organisation.

## Pull request size

- Aim for pull requests under **400 changed lines** (excluding generated files and lockfiles). Larger changes should be split into a stack of smaller PRs.
- One logical change per PR. Refactors and behaviour changes go into separate PRs.
- The PR description must explain *why* the change is needed, link the Jira ticket (for example `ATL-1234`) and describe how it was tested.

## Approvals

| Repository | Required approvals | Notes |
|---|---|---|
| `atlas-core` | 2 | At least one approval must come from a CODEOWNER of the changed path |
| `infra-live` (Terraform) | 2 | One approver must be from the Infrastructure team |
| `beacon` | 1 | CODEOWNER approval required |
| All other repositories | 1 | |

Authors may not approve their own PRs, and approvals are dismissed automatically when new commits are pushed.

## Response times

- Reviewers should give a first response within **1 business day**. If you cannot review in time, say so and suggest another reviewer.
- PRs labelled `hotfix` must be reviewed within 2 hours during working hours.

## What reviewers check

1. Correctness and edge cases, including error handling and timeouts.
2. Tests: new behaviour has unit tests; bug fixes include a regression test.
3. Security: no secrets in code, input validation, authorisation checks on new endpoints.
4. Observability: meaningful logs, metrics for new code paths, alerts linked to runbooks.
5. Backwards compatibility of APIs and database migrations (migrations must be reversible).
6. Readability and naming. Style issues that a linter could catch should be automated, not discussed.

## Comment etiquette

- Prefix non-blocking comments with `nit:` and optional suggestions with `suggestion:`.
- Critique the code, not the person. Ask questions instead of making demands.
- Resolve disagreements within the PR or in a short call; escalate to the team lead only if no agreement is reached within 2 business days.

## Merging

- CI must be green, including unit tests, linting and the security scan (Snyk).
- Use **squash merge** with a Conventional Commits title, for example `feat(query-api): add cursor pagination`.
- The author merges their own PR after approval, not the reviewer.
- Merged changes ship with the next release train (see Deployment Process).
