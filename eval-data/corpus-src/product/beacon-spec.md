---
title: Beacon Product Specification
format: docx
author: Arjun Mehta
updated: 2026-07-28
---
# Beacon Product Specification

**Product:** Beacon (alerting and on-call add-on for Atlas) · **Owner:** Arjun Mehta, Head of Product · **Engineering lead:** Beacon team · **Status:** Generally available since Atlas 4.2 (31 March 2026); available to Growth workspaces since Atlas 5.0 (21 July 2026)

## Problem

Atlas customers receive data incidents (stale tables, failed pipelines, schema changes) but have to route them manually into their own tools. Customers told us that alert noise and unclear ownership are their main reasons for ignoring Atlas notifications. Beacon gives data teams alert routing, deduplication and on-call scheduling built for data incidents.

## Target customers

Data platform and analytics engineering teams on the Growth and Enterprise tiers with at least 5 people sharing responsibility for data quality.

## Key capabilities

### Routing rules

- Route incidents by data source, table tag, monitor severity, domain owner or lineage (for example "everything downstream of the `orders` table").
- Up to 200 routing rules per workspace, evaluated top to bottom; the first match wins unless "continue" is enabled.

### Notification channels

- Slack, Microsoft Teams, email, SMS, PagerDuty, Opsgenie and generic webhooks.
- SMS is available in 40 countries and limited to 100 messages per seat per month.

### Deduplication and grouping

- Alerts with the same fingerprint (monitor, table and failure type) are grouped into one incident.
- The default **deduplication window is 5 minutes**; workspace admins can change it to any value between 1 and 60 minutes.
- Lineage-aware grouping: when an upstream table fails, alerts on downstream tables are attached to the upstream incident instead of paging separately.

### On-call schedules and escalation

- Daily, weekly and custom rotations with overrides.
- Escalation policies with up to 5 levels. Each level waits between 1 and 120 minutes before escalating.
- Business hours rules: low-severity incidents can be held until the next working hour.

### Acknowledgement and resolution

- Incidents can be acknowledged and resolved from Slack, email links or the Atlas Web App.
- Incidents resolve automatically when the underlying monitor recovers, unless "manual resolve" is set.

## Packaging

- Sold as an add-on with SKU BCN-ADDON-ANNUAL (see Atlas Pricing and Tiers).
- Available to Growth and Enterprise workspaces. Not available on Starter.

## Non-functional requirements

| Requirement | Target |
|---|---|
| Notification delivery latency (p95, from incident creation) | under 30 seconds |
| Availability | 99.9% monthly |
| Maximum incidents processed per workspace | 1,000 per minute |
| Audit history of notifications | retained according to the workspace's audit log retention |

## Success metrics

- 40% of Growth and Enterprise workspaces adopt Beacon within 12 months of GA.
- Reduce median time to acknowledge data incidents by 50% compared with Atlas email alerts.
- Fewer than 3 notifications per incident on average after grouping.

## Out of scope for GA

- Native mobile apps (planned, see the Product Roadmap H2 2026).
- Voice call notifications.
- Status pages for end users of customer data products.
