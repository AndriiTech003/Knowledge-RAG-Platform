---
title: Atlas Integrations Catalogue
format: md
author: Arjun Mehta
updated: 2026-09-15
---
# Atlas Integrations Catalogue

**Owner:** Product team (Integrations) · **Last updated:** 15 September 2026

Atlas connects to data warehouses, transformation tools, orchestrators, BI tools and collaboration tools. This catalogue lists all integrations that are generally available or in beta, and how many integrations each tier can connect.

## Integration limits per tier

| Tier | Active integrations per workspace | Custom connectors (Atlas SDK) |
|---|---|---|
| Starter | up to 3 | Not available |
| Growth | up to 15 | Not available |
| Enterprise | Unlimited | Available |

Collaboration integrations (Slack, Microsoft Teams, email) do not count towards the limit.

## Data warehouses and lakehouses

| Integration | Status | Minimum tier | Notes |
|---|---|---|---|
| Snowflake | GA | Starter | Includes cost monitors since Atlas 5.0 |
| Google BigQuery | GA | Starter | |
| Amazon Redshift | GA | Starter | Redshift Serverless supported |
| Databricks | GA | Growth | SQL warehouses and Jobs |
| Databricks Unity Catalog | Beta | Growth | Lineage from Unity Catalog, added in Atlas 5.1 |
| PostgreSQL | GA | Starter | Version 12 and later |
| Microsoft Fabric | Beta | Growth | |

## Transformation and orchestration

| Integration | Status | Minimum tier |
|---|---|---|
| dbt Core | GA | Starter |
| dbt Cloud | GA | Starter |
| Apache Airflow (including Astronomer and MWAA) | GA | Growth |
| Dagster | GA | Growth |
| Fivetran | GA | Growth |
| Airbyte | Beta | Growth |

## BI tools

| Integration | Status | Minimum tier |
|---|---|---|
| Looker | GA | Growth |
| Tableau | GA | Growth |
| Power BI | GA | Enterprise |
| Metabase | Beta | Growth |

## Alerting and collaboration

- Slack and Microsoft Teams: available on all tiers for basic notifications.
- PagerDuty and Opsgenie: available through the Beacon add-on.
- Jira and ServiceNow: create tickets from Atlas incidents; Jira on Growth and Enterprise, ServiceNow on Enterprise.
- Webhooks: all tiers.

## Requesting a new integration

Customers request integrations through their account team. Requests are logged in Salesforce with the type "Integration request". Integrations with more than 10 requests from paying customers are reviewed for the roadmap.

## Building custom connectors

Enterprise customers can build connectors with the Atlas SDK (Python). Custom connectors run in the customer's environment next to the Atlas Collector and must be registered in the workspace settings.
