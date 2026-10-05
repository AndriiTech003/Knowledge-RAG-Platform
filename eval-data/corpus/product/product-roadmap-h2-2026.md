# Product Roadmap H2 2026

**Owner:** Arjun Mehta, Head of Product · **Last updated:** 15 July 2026 · **Status:** Approved by the product leadership group on 10 July 2026

This roadmap lists the major Atlas and Beacon initiatives planned for July to December 2026. Dates are targets, not commitments, and should not be shared with customers as guaranteed delivery dates. Customer-facing communication of roadmap items must use the phrasing "planned" or "in development".

## Themes

1. **Reduce alert fatigue** — fewer, better-grouped notifications.
2. **Lakehouse coverage** — first-class support for Databricks and Apache Iceberg.
3. **Enterprise readiness** — compliance, residency and administration features for large customers.
4. **AI-assisted triage** — help users find the root cause of data incidents faster.

## Planned initiatives

| Initiative | Product | Theme | Target | Status |
|---|---|---|---|---|
| Databricks Unity Catalog integration (beta) | Atlas | Lakehouse coverage | September 2026 | Shipped in Atlas 5.1 |
| Beacon mobile app (iOS and Android) | Beacon | Reduce alert fatigue | GA in November 2026 | In development |
| Atlas Copilot: AI root-cause suggestions | Atlas | AI-assisted triage | Private beta in November 2026 | In development |
| Apache Iceberg table monitoring | Atlas | Lakehouse coverage | December 2026 | In design |
| EU data residency for Starter workspaces in Frankfurt | Atlas | Enterprise readiness | October 2026 | In development |
| Custom roles and permissions | Atlas | Enterprise readiness | December 2026 | In design |
| Beacon voice call notifications | Beacon | Reduce alert fatigue | Q1 2027 | Not started |

## Initiative details

### Beacon mobile app

Native iOS and Android apps built with React Native. Users can receive push notifications, acknowledge and resolve incidents, and swap on-call shifts. The public beta starts in October 2026 for Enterprise customers; general availability is planned for **November 2026** together with Atlas 5.2.

### Atlas Copilot

Atlas Copilot suggests likely root causes for data incidents by combining lineage, recent schema changes, pipeline run history and query logs. The private beta in November 2026 is limited to 20 Enterprise design partners. Copilot will run only on data that already exists in the customer's Atlas workspace and will not train models on customer data.

### Apache Iceberg monitoring

Freshness, volume and schema monitors for Iceberg tables in AWS Glue and REST catalogs. Depends on the Data Platform team's evaluation of Iceberg (Tech Radar: Assess).

### Custom roles and permissions

Enterprise admins will be able to define roles beyond the current Admin, Editor and Viewer, for example a "Monitor author" role that cannot change integrations.

## Not planned for H2 2026

- An on-premises version of Atlas.
- A free tier.
- Native integrations with Oracle databases (re-evaluated in 2027).

## Process

Roadmap changes are proposed in the monthly product review. Sales and Customer Success can request features through the "Product feedback" form in Salesforce; requests are triaged every two weeks by the product managers.
