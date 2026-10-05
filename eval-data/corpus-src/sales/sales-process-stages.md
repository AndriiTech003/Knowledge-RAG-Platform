---
title: Sales Process and Opportunity Stages
format: pdf
author: Tom Lindqvist
updated: 2026-02-16
---
# Sales Process and Opportunity Stages

**Owner:** Tom Lindqvist, VP Sales
**Maintained by:** Revenue Operations (RevOps)
**Applies to:** SDRs, Account Executives, Sales Engineers and Sales Directors in North America and EMEA

## 1. Why stages matter

Every new business and expansion opportunity for Atlas and Beacon is tracked in Salesforce. Opportunity stages describe where the buyer is in their decision, not how busy we are. Forecast categories and pipeline coverage reports are generated from the stage field, so an opportunity may only move forward when the exit criteria of its current stage are met and recorded in Salesforce.

Our methodology is based on MEDDPICC. The required MEDDPICC fields become mandatory in Salesforce from Stage 2 onwards.

## 2. Stage overview

| Stage | Salesforce name | Probability | Owner | Forecast category |
|---|---|---|---|---|
| 0 | Prospecting | 0% | SDR | Omitted |
| 1 | Discovery | 10% | AE | Pipeline |
| 2 | Qualification | 20% | AE | Pipeline |
| 3 | Technical Validation | 40% | AE + Sales Engineer | Best case |
| 4 | Business Case | 60% | AE | Best case |
| 5 | Negotiation | 80% | AE + Sales Director | Commit |
| 6 | Closed Won / Closed Lost | 100% / 0% | AE | Closed |

The average Enterprise sales cycle from Stage 1 to Closed Won was 94 days in 2025; Growth tier deals averaged 41 days.

<<<PAGE>>>
## 3. Stage definitions and exit criteria

### Stage 0 – Prospecting
SDR outreach to target accounts. **Exit:** a discovery meeting is booked with a person who owns a data reliability or platform problem. The SDR converts the lead to an opportunity and hands over to the AE with notes in the "SDR handoff" field.

### Stage 1 – Discovery
The AE understands the current data stack, the pain (for example broken dashboards, failed pipelines, missing alerting) and the cost of doing nothing. **Exit:** a documented pain, an identified champion, and agreement to a second meeting.

### Stage 2 – Qualification
**Exit:** Metrics, Economic buyer, Decision criteria and Decision process are filled in Salesforce; the economic buyer has been identified by name; a mutual action plan (MAP) has been shared with the champion.

### Stage 3 – Technical Validation
A Sales Engineer runs a structured proof of value (POV) on the customer's own data. POVs last a maximum of 21 days and require written success criteria signed off by the customer before the POV starts. **Exit:** the customer confirms in writing that the success criteria were met.

### Stage 4 – Business Case
**Exit:** the economic buyer has reviewed the business case and ROI model, the paper process is known, and procurement and security review (questionnaire, DPA) have started.

### Stage 5 – Negotiation
Commercial terms are negotiated. Any discount must be approved according to the Discount Approval Matrix before the quote is sent. **Exit:** order form signed by the customer.

### Stage 6 – Closed
Closed Won when the order form is countersigned by Northwind. Closed Lost requires a loss reason and the competitor (if any).

<<<PAGE>>>
## 4. Pipeline hygiene rules

- Close dates must not be in the past. RevOps flags opportunities with past close dates every Monday.
- An opportunity that stays in the same stage for more than 45 days is marked "stalled" and reviewed in the weekly pipeline call.
- Next steps must be updated at least every 14 days.
- Opportunities may skip at most one stage; skipping requires a comment from the Sales Director.
- Pipeline coverage target for the next quarter is 3.5x of the team's commit, measured on the first business day of the quarter.

## 5. Weekly cadence

| Meeting | When | Participants |
|---|---|---|
| Team pipeline review | Monday 10:00 local | AEs, Sales Director |
| Forecast call | Wednesday 16:00 Lisbon | Sales Directors, VP Sales, RevOps |
| Deal desk | Tuesday and Thursday | AE, Deal desk analyst, Legal on request |
| Win/loss review | Last Friday of the month | Whole sales team |

## 6. Handover to Customer Success

Within 5 business days of Closed Won, the AE runs a handover call with the assigned Customer Success Manager using the "CS Handover" template in Salesforce. Enterprise customers also receive a kickoff with a Technical Account Manager.
