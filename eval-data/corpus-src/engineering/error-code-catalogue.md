---
title: Atlas Error Code Catalogue
format: html
author: Marta Silva
updated: 2026-06-30
---
# Atlas Error Code Catalogue

This catalogue lists the error codes returned by the Atlas public API, the Ingest Gateway and the Atlas Collector. Every error code has the form `NW-E` followed by four digits. The first digit indicates the category. Support engineers and on-call engineers should link to this page when answering customer tickets.

Last updated: 30 June 2026 · Owner: API Platform team

## Categories

| Prefix | Category |
|---|---|
| NW-E1xxx | Authentication and authorisation |
| NW-E2xxx | Resource and workspace errors |
| NW-E3xxx | Validation and schema errors |
| NW-E4xxx | Ingestion limits and throttling |
| NW-E5xxx | Server-side and upstream errors |

## Error codes

| Code | HTTP status | Meaning | Typical fix |
|---|---|---|---|
| NW-E1001 | 401 | API key is missing or invalid | Check the `Authorization: Bearer` header; regenerate the key in Settings |
| NW-E1003 | 401 | Access token expired | Refresh the OAuth token; tokens are valid for 60 minutes |
| NW-E1010 | 403 | SSO enforcement: password login is disabled for this workspace | Log in through the workspace's identity provider |
| NW-E2004 | 404 | Workspace not found or not accessible with this key | Verify the workspace ID in the URL |
| NW-E2011 | 409 | Monitor with the same name already exists | Use a unique monitor name |
| NW-E3007 | 422 | Event does not match the registered schema | Register the new schema version or fix the producer |
| NW-E3015 | 422 | Timestamp more than 7 days in the past or 1 hour in the future | Fix the client clock or use the backfill API |
| NW-E4012 | 413 | Event batch too large: request payload exceeds the 5 MB maximum | Split the request into batches of at most 1,000 events and under 5 MB |
| NW-E4020 | 429 | Monthly event quota for the workspace exhausted | Contact the account owner to upgrade the plan |
| NW-E4290 | 429 | API rate limit exceeded (token bucket empty, see RFC-0057) | Back off and retry after the `Retry-After` header |
| NW-E5003 | 504 | Query timed out after 30 seconds in ClickHouse | Narrow the time range or add filters |
| NW-E5031 | 503 | Upstream connector unavailable (warehouse or BI tool did not respond) | Retry later; check the integration status page |
| NW-E5099 | 500 | Unexpected internal error | Open a ticket with the `request_id` from the response |

## Notes for on-call engineers

- A spike of NW-E3007 after a customer deploy usually means the customer changed their event schema without registering it. Events with NW-E3007 are written to the dead-letter topic `atlas.events.dlq` (see RFC-0042).
- NW-E4012 errors are rejected at the Ingest Gateway and are never written to Kafka.
- A sudden increase of NW-E5003 for many workspaces at once points to ClickHouse capacity problems; check the Grafana dashboard "ClickHouse / Query latency" and consider declaring a SEV2.
- NW-E5099 should be rare. More than 100 occurrences in 10 minutes triggers an alert to the API Platform on-call.

## Deprecated codes

| Code | Replaced by | Removed in |
|---|---|---|
| NW-E4001 | NW-E4012 | Atlas 4.0 |
| NW-E4299 | NW-E4290 | Atlas 4.3 |
