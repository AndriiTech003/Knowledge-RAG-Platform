---
title: Incident Response Runbook (RB-INC-01)
format: pdf
author: Priya Natarajan
updated: 2026-05-19
---
# Incident Response Runbook (RB-INC-01)

**Runbook ID:** RB-INC-01 · **Owner:** Priya Natarajan, VP Engineering · **Last reviewed:** 19 May 2026 · **Applies to:** Atlas and Beacon production environments (eu-west-1 and us-east-2)

## 1. Purpose

This runbook defines how Northwind Labs engineering detects, triages, communicates and learns from production incidents. It is the single source of truth for severity definitions, paging escalation and postmortem deadlines. Team-specific runbooks (for example RB-DB-07 for Postgres failover or RB-CACHE-02 for Redis eviction) describe the technical fix; this document describes the process around it.

An incident is any unplanned event that degrades the availability, correctness, latency or security of a customer-facing service. When in doubt, declare an incident. Declaring an incident that turns out to be minor costs a few minutes; failing to declare a real one costs customer trust.

## 2. Declaring an incident

1. Anyone in engineering, support or security may declare an incident by typing `/incident declare` in Slack. The bot creates a dedicated channel and a PagerDuty incident.
2. The person declaring picks an initial severity using the table in section 3. Severity can be raised or lowered later by the Incident Commander.
3. The primary on-call engineer for the affected service is paged automatically through PagerDuty.

## 3. Roles

- **Incident Commander (IC):** owns the incident end to end, decides on severity, coordinates responders and approves risky actions such as a regional failover. For SEV1 and SEV2 the IC must not be the person typing commands.
- **Communications Lead:** owns all internal and external updates, including the public status page.
- **Scribe:** keeps a timestamped timeline in the incident channel. The timeline is the primary input for the postmortem.
- **Subject-matter responders:** engineers pulled in by the IC to investigate and mitigate.

For SEV1 incidents all three named roles must be filled within 15 minutes of declaration. For SEV2 the IC may also act as Scribe.

<<<PAGE>>>
## 4. Severity levels

| Severity | Definition | Examples | Acknowledgement target | Status update cadence |
|---|---|---|---|---|
| SEV1 | Critical: full outage or data loss affecting multiple customers | Atlas ingestion down in a region; Beacon not delivering any alerts; confirmed data breach | 5 minutes | Every 30 minutes |
| SEV2 | Major: core feature degraded for many customers, workaround may exist | Query API p99 above 10 s; dashboards failing for one region; delayed alerts | 15 minutes | Every 60 minutes |
| SEV3 | Minor: partial degradation, limited customer impact | One connector failing; slow exports; single-tenant issue | Next business hour | Daily |
| SEV4 | Cosmetic or internal-only issue | UI glitch; internal tooling failure | Next business day | Not required |

## 5. Paging and escalation

All pages are routed through PagerDuty using the service's escalation policy. The escalation chain is automatic and must not be disabled during an incident.

- **SEV1:** if the primary on-call does not acknowledge the page, it is escalated to the **secondary on-call after 10 minutes** without acknowledgement. If neither has acknowledged after 20 minutes, PagerDuty pages the Engineering Manager on duty. After 30 minutes without acknowledgement the VP Engineering is paged directly.
- **SEV2:** escalated to the secondary on-call after 20 minutes without acknowledgement, and to the Engineering Manager on duty after 45 minutes.
- **SEV3 and SEV4:** no automatic escalation. Tickets are created in Jira in the owning team's queue.

Acknowledging a page means you are actively working on it. Do not acknowledge a page just to silence it; if you cannot respond, press "Escalate" in PagerDuty so the next responder is paged immediately.

<<<PAGE>>>
## 6. Communication rules

Clear communication matters as much as the technical fix. The following rules apply to every SEV1 and SEV2 incident:

- **One channel per incident.** The Slack bot names it `#inc-YYYYMMDD-short-name`, for example `#inc-20260412-ingest-eu`. Side conversations in direct messages are not allowed; everything relevant goes into the incident channel.
- **Status page.** The Communications Lead posts the first public status page update within 15 minutes of declaring a SEV1 and within 30 minutes for a SEV2. Updates follow the cadence in the severity table, even if there is nothing new to report ("We are continuing to investigate").
- **Enterprise customers.** For SEV1 incidents, the Customer Success team notifies affected Enterprise customers directly within 30 minutes, using the template "Enterprise incident notice" in Notion.
- **No speculation externally.** Public updates describe impact and mitigation, never a suspected root cause. Root cause is shared only after the postmortem is approved.
- **Security incidents.** If customer data may be exposed, the IC must immediately involve the Head of Security, Jonas Weber. Security incidents use a private channel and external communication is approved by Security and Legal.
- **Executive updates.** For SEV1, the IC posts a two-line summary in `#exec-incidents` every hour until resolution.

### Closing an incident

The IC declares the incident resolved when customer impact has ended and monitoring has been stable for at least 30 minutes. The Communications Lead posts a final status page update and the Scribe exports the timeline to the postmortem document.

<<<PAGE>>>
## 7. Postmortems

Every SEV1 and SEV2 incident requires a written postmortem. SEV3 incidents require one only if the IC requests it.

- **Deadline:** the postmortem must be published within **5 business days** of the incident being resolved.
- **Format:** use the "Blameless postmortem" template in Notion. Sections: summary, customer impact, timeline, root cause, contributing factors, what went well, action items.
- **Blameless culture:** postmortems describe systems and decisions, not individual fault. Names appear only in the timeline.
- **Action items:** each action item is filed in Jira with the label `postmortem` and an owner. Priority P1 action items must be completed within 30 days; P2 within 90 days.
- **Review:** postmortems are presented at the weekly Reliability Review, held on Wednesdays at 16:00 Lisbon time and chaired by the VP Engineering.

## 8. Related documents

- On-Call Policy (rotation rules and handoffs)
- RB-DB-07 Postgres Failover runbook
- RB-CACHE-02 Redis Eviction runbook
- RFC-0051 Multi-Region Failover
