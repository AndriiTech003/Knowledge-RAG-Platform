---
title: Atlas Pricing and Tiers
format: pdf
author: Arjun Mehta
updated: 2026-07-21
---
# Atlas Pricing and Tiers

**Owner:** Arjun Mehta, Head of Product · **Effective:** 21 July 2026 · **Audience:** Product, Engineering, Sales and Customer Success

This document is the reference list price sheet for Atlas and the Beacon add-on. All prices are in USD, per seat, per month, before taxes. Discounts and deal approvals are handled by the Sales team and are not covered here.

## 1. Tiers at a glance

Atlas is sold in three tiers. **Starter** is designed for small data teams getting started with observability, **Growth** for scaling data teams with several pipelines and warehouses, and **Enterprise** for organisations with strict security, compliance and support requirements.

A "seat" is a named user who can log in to the Atlas Web App. Viewers who only receive alerts through Slack or email do not need a seat.

## 2. List prices and SKUs

| Tier | Billing | SKU | List price per seat per month | Seat limits |
|---|---|---|---|---|
| Starter | Monthly | ATL-STR-MONTHLY | $29 | 3 to 20 seats |
| Starter | Annual | ATL-STR-ANNUAL | $24 | 3 to 20 seats |
| Growth | Monthly | ATL-GRW-MONTHLY | $59 | minimum 5 seats |
| Growth | Annual | ATL-GRW-ANNUAL | $49 | minimum 5 seats |
| Enterprise | Annual only | ATL-ENT-ANNUAL | $89 | minimum 25 seats |

Annual plans are invoiced upfront for 12 months. Monthly plans can be cancelled at the end of any billing month. Enterprise contracts are annual or multi-year only.

## 3. Add-ons

| Add-on | SKU | Price | Available on |
|---|---|---|---|
| Beacon alerting and on-call | BCN-ADDON-ANNUAL | $12 per seat per month | Growth and Enterprise |
| Isolated compute (dedicated ClickHouse cluster) | ATL-ISO-ANNUAL | $2,500 per month per region | Enterprise |
| Premium onboarding (6 weeks, guided) | ATL-ONB-ONCE | $7,500 one-time | Growth and Enterprise |
| Additional event volume (per 100 million events per month) | ATL-EVT-100M | $400 per month | all tiers |

<<<PAGE>>>
## 4. Feature comparison

| Feature | Starter | Growth | Enterprise |
|---|---|---|---|
| Included event volume per month | 50 million | 500 million | 5 billion |
| Monitors | up to 50 | up to 500 | unlimited |
| Anomaly detection (freshness, volume, schema) | Yes | Yes | Yes |
| Distribution and custom SQL monitors | No | Yes | Yes |
| Column-level lineage | No | Yes | Yes |
| Beacon add-on | No | Optional | Optional |
| SSO (SAML via Okta, Entra ID, Google) | No | No | Yes |
| SCIM user provisioning | No | No | Yes |
| Audit log export | No | No | Yes |
| Isolated compute | No | No | Optional add-on |
| Data residency choice (EU or US) | EU or US at signup | EU or US at signup | EU or US, plus dedicated region on request |

## 5. Support levels

| Support | Starter | Growth | Enterprise |
|---|---|---|---|
| Channels | Email | Email and chat | Email, chat, phone, shared Slack channel |
| P1 first response | 2 business days | 8 business hours | 1 hour, 24/7 |
| Named Technical Account Manager | No | No | Yes |
| Uptime SLA | none | 99.5% | 99.9% with service credits |

<<<PAGE>>>
## 6. Trials

- A 14-day free trial of the Growth tier is available for new workspaces. The trial includes up to 10 seats and 50 million events.
- At the end of the trial the workspace converts to Starter monthly unless the customer chooses a plan; data beyond Starter limits is retained for 30 days to allow an upgrade.

## 7. Upgrades and downgrades

- Upgrades take effect immediately and are prorated.
- Downgrades take effect at the end of the current billing period. When moving to a lower tier, retention and monitor limits of the new tier apply from the downgrade date.

## 8. Changes in this version

- Enterprise list price changed from $82 to $89 per seat per month for new contracts signed from 21 July 2026, the general availability date of Atlas 5.0. Existing contracts keep their price until renewal.
- Beacon is now available on Growth (previously Enterprise only), starting with Atlas 5.0.
