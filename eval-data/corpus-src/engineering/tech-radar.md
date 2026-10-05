---
title: Engineering Tech Radar 2026
format: html
author: Lukas Brandt
updated: 2026-07-01
---
# Engineering Tech Radar 2026

The Tech Radar records which languages, frameworks, tools and platforms Northwind Labs engineers should use for new work. It is maintained by the Architecture Review group and updated twice a year, in January and July. This is the **July 2026** edition.

## Rings

- **Adopt:** proven at Northwind Labs; the default choice for new work.
- **Trial:** worth using on a real project with a clear owner; talk to the Architecture Review group first.
- **Assess:** worth exploring in spikes and prototypes, not in production.
- **Hold:** do not start new work with it; existing usage should be migrated over time.

## Languages and frameworks

| Technology | Ring | Notes |
|---|---|---|
| Go | Adopt | Default for high-throughput services and the Atlas Collector |
| Python (FastAPI) | Adopt | Default for APIs and data science services |
| TypeScript (React, Node.js) | Adopt | Web App and Beacon Notification Service |
| Rust | Trial | Being trialled for the Collector's parsing hot path; owner: Integrations team |
| Kotlin | Hold | Only used in the legacy Android prototype; Beacon mobile uses React Native |

## Data and storage

| Technology | Ring | Notes |
|---|---|---|
| ClickHouse | Adopt | Analytical store (RFC-0042) |
| PostgreSQL 16 with Patroni | Adopt | Metadata store |
| Apache Kafka | Adopt | Event streaming |
| DuckDB | Assess | Evaluated for in-browser and local analytics |
| Apache Iceberg | Assess | For long-term cold storage of raw events |
| MongoDB | Hold | No new usage; last collection to be migrated by Q4 2026 |
| Elasticsearch | Hold | Replaced by ClickHouse full-text indexes for log search |

## Infrastructure and tooling

| Technology | Ring | Notes |
|---|---|---|
| Terraform | Adopt | All cloud infrastructure in `infra-live` |
| Argo CD | Adopt | GitOps deployments |
| OpenTelemetry | Adopt | Standard for traces, metrics and logs |
| GitHub Actions | Adopt | CI for all repositories |
| Temporal | Trial | Durable workflows for backfills and long-running exports |
| LaunchDarkly | Adopt | Feature flags |
| WebAssembly plugins | Assess | Customer-defined checks running in a sandbox |
| Jenkins | Hold | Remaining jobs migrate to GitHub Actions by 31 December 2026 |
| Helm charts written by hand | Hold | Use the shared `nw-service` chart instead |

## Changes since the January 2026 edition

- **Temporal** moved from Assess to Trial after the successful backfill orchestration pilot.
- **Rust** moved from Assess to Trial.
- **Elasticsearch** moved from Trial to Hold.
- **Apache Iceberg** was added in Assess.

## Proposing a change

Open an issue in the `architecture` repository with the template "Tech Radar proposal". Proposals are discussed in the monthly Architecture Review meeting, held on the first Thursday of every month.
