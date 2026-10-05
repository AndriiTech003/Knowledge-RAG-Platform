---
title: Deployment Process and Release Train (2026)
format: pdf
author: Hana Kowalczyk
updated: 2026-08-25
---
# Deployment Process and Release Train (2026)

**Owner:** Infrastructure team · **Approved by:** Priya Natarajan, VP Engineering · **Effective:** 1 September 2026

**This document supersedes "Deployment Process (2024 edition)".** Where the two documents differ, this version applies. The 2024 edition is kept only for historical reference.

## 1. Overview

Atlas and Beacon services are deployed to production through a scheduled **release train** that departs twice a week, on **Tuesdays and Thursdays**. Everything merged to the `main` branch before the branch cut is included in the next train. Deployments are executed by the deployment tool `shipit` through GitHub Actions and Argo CD; nobody deploys to production from a laptop.

## 2. Release train schedule

| Step | Time (Lisbon time) | Responsible |
|---|---|---|
| Branch cut (`release/YYYY-MM-DD`) | 11:00 on train day | Release captain (automated) |
| Staging deploy and smoke tests | 11:15–13:00 | Release captain |
| Go/no-go check in `#release-train` | 13:30 | Release captain and team leads |
| Production canary starts | 14:00 | shipit |
| Full rollout complete | by 16:00 | shipit |

The release captain rotates weekly among senior engineers and is listed in the `#release-train` channel topic. If a train is cancelled (for example because of an ongoing SEV1 or SEV2), changes roll over to the next train.

## 3. Canary and rollback

- Every production deploy starts with a **canary at 5% of traffic for 30 minutes** in each region, eu-west-1 first and us-east-2 second.
- shipit compares the canary with the baseline. The deploy is **rolled back automatically if the canary error rate is above 2%** or if p99 latency is more than 25% higher than the baseline.
- After a successful canary the rollout proceeds to 25%, 50% and 100% in 15-minute steps.
- Manual rollback: `shipit rollback <service> --to <previous-release>`. A rollback does not need approval and should be the first reaction to a bad deploy.

<<<PAGE>>>
## 4. Hotfixes

A hotfix is a change deployed outside the release train. Hotfixes are allowed only to fix a customer-facing defect or a security issue.

- The PR must carry the `hotfix` label and be reviewed within 2 hours (see Code Review Guidelines).
- An Engineering Manager must approve the hotfix in the `#release-train` channel before deployment.
- Hotfixes go through the same canary as regular deploys; the canary duration may be reduced to 10 minutes only for SEV1 mitigations, with Incident Commander approval.
- No hotfixes on Fridays after 15:00 or on weekends, except to mitigate a SEV1 or SEV2.

## 5. Database migrations

- Migrations must be backwards compatible with the currently deployed version (expand–contract pattern).
- Migrations run as a separate pre-deploy step in the train and must complete in under 10 minutes on production-sized data; longer migrations are executed as background jobs.
- Destructive migrations (dropping columns or tables) need sign-off from the owning team lead and must wait at least two trains after the code no longer uses the column.

## 6. Feature flags

New user-facing features are shipped dark behind a LaunchDarkly flag. Flags are removed within 60 days of reaching 100% rollout. The Product team decides when a flag is turned on for customers.

## 7. End-of-year code freeze

To protect customers during the holiday period, a production code freeze applies at the end of every year.

- The **2026 code freeze starts on Friday, 18 December 2026 at 18:00 Lisbon time** and ends on **Monday, 4 January 2027 at 09:00**.
- No release trains run during the freeze. The last train before the freeze departs on Thursday, 17 December 2026.
- During the freeze only hotfixes for SEV1 or SEV2 incidents and security fixes are allowed, each approved by the VP Engineering.
- Infrastructure changes through `infra-live` are also frozen, except for capacity increases.

From 2026 onwards, the freeze always starts on the third Friday of December. (The 2024 edition of this document used a fixed start date of 15 December, which no longer applies.)

<<<PAGE>>>
## 8. Responsibilities

| Role | Responsibility |
|---|---|
| Change author | Merges before branch cut, monitors their change during the canary, writes the release note entry |
| Release captain | Runs the train, makes the go/no-go call, communicates delays |
| Team lead | Confirms readiness of risky changes at the go/no-go check |
| Infrastructure team | Owns shipit, Argo CD and the train tooling |

## 9. Release notes

Each customer-visible change requires an entry in the `CHANGELOG.md` of the service. The Product team compiles the public Atlas release notes from these entries for every minor version.

## 10. Metrics

The Infrastructure team reports monthly on:

- deployment frequency (target: at least 8 trains per month);
- change failure rate (target: below 5% of deploys rolled back);
- mean time to restore after a failed deploy (target: under 30 minutes).

## 11. Change history

| Version | Date | Change |
|---|---|---|
| 2024 edition | 10 September 2024 | Original process; freeze fixed to 15 December |
| 2026 | 25 August 2026 | Canary metrics, hotfix rules, freeze moved to third Friday of December (18 December 2026) |
