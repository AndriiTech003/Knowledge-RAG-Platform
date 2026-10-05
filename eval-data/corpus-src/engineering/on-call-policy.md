---
title: Engineering On-Call Policy
format: docx
author: Priya Natarajan
updated: 2026-01-26
---
# Engineering On-Call Policy

**Owner:** Priya Natarajan, VP Engineering · **Effective:** 1 February 2026 · **Applies to:** all engineering teams that own production services

## Purpose

Atlas and Beacon customers rely on us around the clock. This policy sets fair and predictable rules for who is on call, for how long, and what is expected while on call. The incident process itself (severities, escalation timings, communication and postmortems) is defined in the Incident Response Runbook, RB-INC-01, and is not repeated here.

## Rotations

- Each team that owns a production service maintains a **primary** and a **secondary** rotation in PagerDuty. Schedule names follow the pattern `<team>-primary` and `<team>-secondary`, for example `data-platform-primary`.
- Rotations are **one week long**. The handoff happens every **Monday at 10:00 Lisbon time**.
- Follow-the-sun: teams with engineers in both Europe and the US may split each day into two 12-hour shifts (07:00–19:00 Lisbon time and 19:00–07:00 covered from Austin).
- An engineer may be scheduled for **no more than one week in four** across primary and secondary combined. Exceptions require approval from the Engineering Manager and may not happen in two consecutive months.

## Eligibility

- Engineers join the primary rotation after **3 months** at Northwind Labs. Before that, they shadow at least one rotation (see the Engineering Onboarding Guide).
- Managers of teams owning production services join the secondary rotation of their team.
- Engineers on parental leave, sick leave or holiday are removed from the schedule; swaps are arranged in PagerDuty with an override, not by private agreement.

## Expectations while on call

- Keep a laptop and a charged phone with the PagerDuty app within reach.
- Be able to start working on a page within the acknowledgement target defined in RB-INC-01.
- Do not schedule travel without connectivity, and do not consume alcohol to a degree that would affect your judgment.
- Keep the team's runbooks up to date. If a page had no runbook, write one within two weeks.

## Handoff

At every handoff the outgoing primary posts a short note in the Slack channel `#oncall-handoff` with:

- open incidents and their status;
- noisy alerts that fired more than three times;
- planned maintenance during the coming week.

The incoming primary acknowledges the note with a reply in the thread.

## Rest and recovery

- If you were paged between 23:00 and 07:00 local time, you may start work later the next day without asking.
- After an on-call week with **two or more night pages**, you are entitled to one day off in lieu, to be taken within the following four weeks and recorded in Workday as "On-call recovery".
- On-call allowances are governed by the People team's compensation policies and are not described in this document.

## Alert hygiene

- Every alert that pages must be actionable and link to a runbook.
- Teams review their paging alerts monthly. Any alert that fired more than 10 times in a month without action must be fixed or downgraded to a ticket.
- The goal is fewer than 2 night pages per team per week on average.

## Review

This policy is reviewed every 12 months by the VP Engineering together with team leads.
