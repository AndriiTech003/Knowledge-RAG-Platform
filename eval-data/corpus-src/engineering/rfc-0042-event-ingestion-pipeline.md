---
title: RFC-0042 Event Ingestion Pipeline (Kafka to ClickHouse)
format: pdf
author: Lukas Brandt
updated: 2025-11-12
---
# RFC-0042: Event Ingestion Pipeline (Kafka to ClickHouse)

**RFC:** RFC-0042 · **Author:** Lukas Brandt (Staff Engineer, Data Platform) · **Reviewers:** Priya Natarajan, Hana Kowalczyk · **Status:** Accepted on 12 November 2025 · **Target completion:** Q1 2026

## Summary

This RFC replaces the legacy Atlas ingestion path, in which the Ingest Gateway wrote events directly into Postgres staging tables, with a streaming pipeline built on Apache Kafka and ClickHouse. The goal is to support at least 10x current event volume, reduce end-to-end latency and decouple ingestion from the metadata database.

## Motivation

- Peak ingest volume grew from 90,000 events per second in January 2025 to 310,000 events per second in October 2025. The Postgres staging tables are now the main source of SEV2 incidents for the Data Platform team (7 of 11 incidents in Q3 2025).
- Customers on the Enterprise tier expect query freshness under one minute. The current pipeline has a p99 end-to-end latency of 4 minutes.
- Bulk backfills from customer warehouses block live ingestion because both share the same write path.

## Goals

1. Sustain **1.2 million events per second** at peak across both regions with headroom of 30%.
2. Achieve a **p99 end-to-end latency of 15 seconds** from Ingest Gateway acknowledgement to the event being queryable.
3. Guarantee at-least-once delivery with idempotent writes, so duplicates are removed at query time.
4. Isolate backfills from live traffic.

## Non-goals

- Changing the public ingestion API or the Atlas Collector protocol.
- Moving metadata (workspaces, monitors, users) out of Postgres.

<<<PAGE>>>
## Design

### Kafka layer

- Main topic: `atlas.events.v2`, with **48 partitions**, replication factor 3 and `min.insync.replicas=2`.
- Partition key: `workspace_id`, so that events of a single workspace stay ordered.
- Topic retention: 72 hours, which allows a full replay of three days of data if the ClickHouse sink falls behind or a bad deploy corrupts data.
- Backfill topic: `atlas.backfill.v1` with 12 partitions, consumed by a separate consumer group with lower priority.
- Dead-letter topic: `atlas.events.dlq`. Events that fail schema validation or exceed size limits are written here together with the error code. The dead-letter topic is retained for **14 days**, after which events are discarded. The Data Platform on-call reviews DLQ volume daily.
- Schemas are stored as Avro in the Confluent-compatible schema registry. Producers must register a schema before publishing; incompatible schema changes are rejected.

### ClickHouse layer

- Cluster `ch-atlas-prod`: 6 shards with 2 replicas each, per region.
- Table engine: `ReplicatedReplacingMergeTree`, partitioned by `toYYYYMMDD(event_time)` and ordered by `(workspace_id, event_type, event_time)`.
- The sink consumer group `ch-sink` writes batches of up to **50,000 rows or every 2 seconds**, whichever comes first.
- Row-level TTL on the raw events table is derived from the workspace tier, so that raw events are deleted automatically when the retention limit of the customer's plan is reached.

### Failure handling

| Failure | Behaviour |
|---|---|
| ClickHouse shard unavailable | Consumer pauses partitions for that shard; Kafka buffers up to 72 hours |
| Schema validation error | Event written to `atlas.events.dlq` with error code |
| Consumer lag above 5 minutes | Alert to Data Platform on-call (SEV3), above 15 minutes SEV2 |
| Duplicate events | Removed by ReplacingMergeTree on `event_id` |

<<<PAGE>>>
## Alternatives considered

- **Apache Druid.** Strong real-time ingestion but higher operational cost and a smaller in-house skill base. Rejected.
- **BigQuery streaming inserts.** Simple to operate but would tie Atlas to a single cloud provider and increase per-event cost roughly 4x at projected volume. Rejected.
- **Keeping Postgres with partitioning.** Benchmarks showed write amplification at 400,000 events per second. Rejected.

## Rollout plan

| Phase | Scope | Date |
|---|---|---|
| 1 | Shadow writes to Kafka and ClickHouse for internal workspaces | December 2025 |
| 2 | 10% of Starter and Growth workspaces read from ClickHouse | January 2026 |
| 3 | All workspaces in eu-west-1 | February 2026 |
| 4 | All workspaces in us-east-2; Postgres staging tables removed | March 2026 |

## Monitoring

- Consumer lag per partition (Grafana dashboard "Ingestion / Kafka lag").
- DLQ rate, alerting when more than 0.5% of events in a 10-minute window land in the dead-letter topic.
- End-to-end latency measured by synthetic canary events emitted every 10 seconds per region.

## Open questions

- Whether to move the backfill topic to a dedicated Kafka cluster in 2027.
- Compression codec for cold partitions (ZSTD level 3 vs level 6).

## Decision

Accepted by the Architecture Review on 12 November 2025. Implementation owned by the Data Platform team.
