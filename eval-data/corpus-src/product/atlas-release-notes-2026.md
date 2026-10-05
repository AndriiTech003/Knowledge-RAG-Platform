---
title: Atlas Release Notes 2026
format: html
author: Arjun Mehta
updated: 2026-09-15
---
# Atlas Release Notes 2026

This page collects the release notes for every Atlas minor version shipped in 2026. Patch releases (for example 4.2.1) contain only bug fixes and are listed in the in-app changelog. Versions are listed newest first.

## Atlas 5.1 — released 15 September 2026

- **Longer metric history for Enterprise:** aggregated metric retention for Enterprise workspaces increased from 13 to 25 months.
- **Databricks Unity Catalog integration (beta):** table and column lineage from Unity Catalog, available on Growth and Enterprise.
- **Monitor templates:** 30 ready-made monitor templates for common dbt models.
- Fixed: CSV exports larger than 1 GB no longer time out.

## Atlas 5.0 — released 21 July 2026

Atlas 5 is our biggest release of the year. General availability was originally planned for June and moved to 21 July 2026 to complete performance testing.

- **Redesigned Atlas Web App** with a new incident inbox and workspace home page.
- **Snowflake cost monitors:** track warehouse credit consumption per table and alert on unexpected spikes.
- **Beacon on Growth:** the Beacon add-on can now be purchased by Growth workspaces (previously Enterprise only).
- **Bulk monitor editing** for up to 500 monitors at once.
- Removed: the v1 ingestion endpoint `POST /v1/events`. Use `POST /v2/events`.

## Atlas 4.3 — released 12 May 2026

- **API rate limit headers:** every public API response now includes `X-RateLimit-Limit`, `X-RateLimit-Remaining` and `X-RateLimit-Reset`, and tier-based API rate limits are enforced for all workspaces.
- **Anomaly detection v2:** seasonality-aware volume models reduce false positives by about 35% in our benchmark.
- **Lineage export** to OpenLineage JSON.
- Fixed: schema change monitors could fire twice for renamed columns.

## Atlas 4.2 — released 31 March 2026

- **Beacon is generally available.** Alert routing, deduplication, on-call schedules and escalation policies for data incidents. Initially available to Enterprise workspaces.
- **SCIM provisioning** for Enterprise workspaces with Okta and Microsoft Entra ID.
- Improved incident timeline with lineage context.

## Atlas 4.1 — released 24 February 2026

- **dbt Cloud integration:** import dbt Cloud jobs, test results and model ownership.
- **Faster dashboards:** query results are cached for 5 minutes, making repeated dashboard loads up to 4x faster.
- Fixed: time zone handling for freshness monitors in workspaces outside UTC.

## Atlas 4.0 — released 20 January 2026

- **New lineage graph** with column-level lineage for Growth and Enterprise.
- **Streaming ingestion backend:** events become queryable much faster than before; most customers see data within seconds.
- New error codes for ingestion limits; the code for oversized batches is now NW-E4012.
- Removed: legacy Atlas Collector versions below 2.0 are no longer supported.

## Upcoming

The next minor version, Atlas 5.2, is planned for November 2026. See the Product Roadmap H2 2026 for planned features.
