---
title: RFC-0051 Multi-Region Failover
format: docx
author: Hana Kowalczyk
updated: 2026-02-03
---
# RFC-0051: Multi-Region Failover

**RFC:** RFC-0051 · **Author:** Hana Kowalczyk (Principal Engineer, Infrastructure) · **Status:** Accepted on 3 February 2026 · **Reviewers:** Priya Natarajan, Lukas Brandt, Jonas Weber

## Summary

Atlas runs in two AWS regions: eu-west-1 (Ireland), which hosts EU customer workspaces, and us-east-2 (Ohio), which hosts US customer workspaces. Today each region is independent and a full regional outage means a full outage for the customers homed there. This RFC introduces a warm-standby failover so that each region can take over the other's control plane and recent data within a defined recovery objective.

## Recovery objectives

| Objective | Target | Notes |
|---|---|---|
| Recovery Time Objective (RTO) | 30 minutes | From the failover decision to customers being able to log in and query |
| Recovery Point Objective (RPO) | 5 minutes | Maximum data loss for metadata (Postgres) |
| Event data RPO | 15 minutes | Kafka MirrorMaker replication lag budget |

EU customer data is replicated only to a dedicated, encrypted EU-isolated standby in eu-central-1 (Frankfurt), not to us-east-2, in order to respect data residency commitments. US customer data is replicated to us-west-2 (Oregon).

## Design

### Metadata (Postgres)

The primary Patroni cluster `pg-atlas-main` streams WAL asynchronously to a standby cluster in the paired region. The standby is promoted using the procedure in runbook RB-DB-07 (cross-region section). Asynchronous replication is accepted because synchronous cross-region commits would add around 25 ms to every write.

### Events (Kafka and ClickHouse)

Kafka MirrorMaker 2 replicates the `atlas.events.v2` topic to the standby region. A standby ClickHouse cluster with 3 shards consumes the mirrored topic. After failover the standby cluster serves queries with reduced capacity until it is scaled out.

### Traffic

Customer traffic reaches Atlas through regional hostnames behind Amazon Route 53. Health checks run every 10 seconds; DNS records use a TTL of 60 seconds. Failover is **not automatic**: Route 53 health checks raise an alert, and the switch is executed by a human.

## Failover decision

A regional failover may only be executed during a declared SEV1 incident. It requires approval from both the Incident Commander and the VP Engineering (or, if unavailable, the Engineering Manager on duty). The decision should be made when the primary region has been unavailable for 15 minutes and AWS has not given an estimated recovery time.

## Failback

Failback to the primary region is scheduled as a planned maintenance within 7 days after the primary region is healthy, announced to customers at least 48 hours in advance.

## Testing

- A failover game day is run once per quarter, alternating regions. The first game day took place on 18 March 2026 and achieved an RTO of 22 minutes.
- Results are recorded in Notion under "Reliability / Game days".

## Cost

The warm standby roughly adds 35% to the infrastructure footprint of each region. The cost breakdown is tracked by Finance and is not part of this RFC.

## Alternatives considered

- **Active-active multi-region.** Rejected for now because of the complexity of conflict resolution in the metadata store.
- **Backup and restore only.** Rejected because the restore time for the largest workspaces exceeds 6 hours.
