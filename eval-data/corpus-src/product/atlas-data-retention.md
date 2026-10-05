---
title: Atlas Data Retention Limits by Tier
format: html
author: Arjun Mehta
updated: 2026-09-15
---
# Atlas Data Retention Limits by Tier

This page defines how long Atlas keeps customer data in each pricing tier. It reflects the changes released in Atlas 5.1 (15 September 2026). Engineering enforces these limits automatically through storage TTLs; Sales and Customer Success should use this page when answering customer questions about retention.

## Retention per data type and tier

| Data type | Starter | Growth | Enterprise |
|---|---|---|---|
| Raw events (query logs, pipeline run events) | 30 days | 90 days | 400 days |
| Aggregated metrics (freshness, volume, row counts) | 6 months | 13 months | 25 months |
| Incidents and incident timelines | 12 months | 24 months | 36 months |
| Audit log | 90 days | 1 year | 7 years |
| Query history snapshots | 14 days | 30 days | 90 days |
| Anomaly model training windows | 60 days | 180 days | 400 days |

Retention is measured from the time the data is received by Atlas, not from the event timestamp.

## Extended retention

- Enterprise customers can purchase extended raw event retention of up to 3 years as part of a custom contract.
- Growth and Starter customers who need longer retention must upgrade their tier.

## Changing tiers

- **Upgrade:** the longer retention applies from the upgrade date. Data that was already deleted cannot be restored.
- **Downgrade:** the shorter retention of the new tier applies from the downgrade date. Data older than the new limit is deleted within 7 days after the downgrade.

## Deletion after contract end

- When a contract ends, the workspace becomes read-only for 30 days so customers can export data.
- All customer data, including backups, is permanently deleted within **60 days** after the end of the contract. A deletion certificate is available to Enterprise customers on request.

## Customer-initiated deletion

Workspace admins can delete individual data sources at any time. Deletion requests through the API (`DELETE /v2/sources/{id}`) are processed within 24 hours.

## Frequently asked questions

**Do retention limits apply to metadata like monitor definitions?** No. Monitor definitions, integration settings and users are kept for as long as the workspace exists.

**Are trial workspaces subject to Starter retention?** Trials use Growth retention during the trial period.

**Where is the data stored?** In the region chosen at signup (EU or US). See Atlas Pricing and Tiers for data residency options.
