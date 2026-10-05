---
title: Deployment Process (2024 edition)
format: docx
author: Hana Kowalczyk
updated: 2024-09-10
---
# Deployment Process (2024 edition)

**Owner:** Infrastructure team · **Effective:** 1 October 2024

## Overview

All production deployments of Atlas services go through the release train. The train departs on **Tuesdays and Thursdays**. Changes merged to `main` before the branch cut are included automatically.

## Release train

- Branch cut happens at 10:00 Lisbon time on the train day.
- The release captain deploys to staging, runs the smoke test suite and posts the go/no-go decision in `#release-train`.
- Production deploys start in eu-west-1 and continue in us-east-2 once the first region is healthy.

## Rollbacks

If a deploy causes errors, the release captain rolls back with the deployment tool. Rollbacks do not need approval.

## Hotfixes

Hotfixes outside the train are allowed for customer-facing defects. They require approval from an Engineering Manager in `#release-train`.

## Database migrations

Migrations must be backwards compatible and reviewed by a second engineer from the owning team.

## End-of-year code freeze

- The code freeze **starts on 15 December** every year at 18:00 Lisbon time and ends on the first Monday of January at 09:00.
- No release trains run during the freeze.
- Only fixes for SEV1 incidents and security fixes are allowed during the freeze, approved by the VP Engineering.

## Release captain

The release captain is a senior engineer who runs the train for one week. The captain is responsible for the branch cut, the staging smoke tests, the go/no-go call and for announcing delays in `#release-train`. If a train is skipped, all merged changes roll over to the next train.

## Monitoring after a deploy

The author of each change watches the service dashboards in Grafana for at least 30 minutes after their change reaches production. Any increase in error rates must be reported to the release captain immediately, who decides whether to roll back.

## Contacts

Questions about this process go to the Infrastructure team in `#infra-help`.
