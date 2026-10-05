# Engineering Onboarding Guide

Welcome to Northwind Labs engineering! This guide covers the engineering-specific part of onboarding. The general company onboarding (laptop, benefits, offices) is described in the Company Handbook.

## Your first day

- You are assigned an **onboarding buddy** from your team. Your buddy is your first point of contact for questions during your first 6 weeks.
- Log in to Okta and accept the invitations for GitHub (organisation `northwind-labs`), Jira, PagerDuty, Grafana and Notion.
- Join the Slack channels `#engineering`, `#release-train`, `#incidents`, `#oncall-handoff` and your team channel.

## Setting up your development environment

1. Install the Northwind developer CLI: `brew install northwind-labs/tap/nw`.
2. Clone the `atlas-core` monorepo.
3. Run **`nw dev up`** in the repository root. It starts local Postgres, ClickHouse, Kafka and Redis containers, applies migrations and seeds a demo workspace named `acme-demo`.
4. Run `nw test --changed` to execute tests for the packages you modified.
5. Open the local web app at `http://localhost:3000` and log in with `dev@northwind.local`.

The full setup should take under one hour. If `nw dev up` fails, ask in `#dev-env`.

## Access to environments

| Environment | Access | How to request |
|---|---|---|
| Local | Immediately | Not needed |
| Staging | Day 1 | Automatic through Okta group `eng-staging` |
| Production (read-only) | After week 2 | Request in Okta, approved by your manager |
| Production (write, just-in-time) | After joining on-call | Okta just-in-time request, expires after 4 hours |

## Milestones

- **Week 1:** merge your first pull request (a small fix or documentation change is fine). We aim for every new engineer to ship to production in their first 5 working days.
- **Week 2:** read the Atlas Architecture Overview, the Code Review Guidelines and the Deployment Process.
- **Week 4:** pick up a medium-sized ticket from your team's backlog.
- **Week 6:** shadow a full on-call week with your team's primary on-call.
- **Month 3:** join the primary on-call rotation (see the Engineering On-Call Policy).

## Required reading

- Atlas Architecture Overview
- Incident Response Runbook (RB-INC-01)
- Code Review Guidelines
- Deployment Process and Release Train (2026)
- Engineering Tech Radar 2026

## Learning sessions

Every second Wednesday at 15:00 Lisbon time there is an "Atlas Internals" session recorded in Notion. New engineers are expected to watch the recordings on ingestion (RFC-0042), detection models and Beacon routing within their first month.

## Feedback

At the end of week 6 you will get a short survey about the onboarding experience. Please also suggest improvements to this guide directly through a pull request to the `eng-docs` repository.
