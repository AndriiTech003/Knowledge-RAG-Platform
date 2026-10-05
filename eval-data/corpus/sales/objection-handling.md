# Objection Handling Guide

This guide collects the objections Northwind account executives hear most often when selling Atlas and Beacon, with the responses that worked best in recorded Gong calls from 2025 and early 2026. Use the LAER method: **Listen, Acknowledge, Explore, Respond**. Never respond before you have explored what is behind the objection.

## 1. "It's too expensive."

- **Explore:** "Compared with what? Another tool, or the budget you had in mind?" Find out whether the issue is price, budget timing or value.
- **Respond:** quantify the cost of data incidents. Use the ROI calculator in the Sales Enablement Notion space: the customer's number of data incidents per month, hours per incident, and the hourly cost of the data team.
- **Options:** offer a smaller starting scope (fewer monitored tables) or the Growth tier rather than discounting. Any discount follows the Discount Approval Matrix.

## 2. "We can build this ourselves."

- **Explore:** "How many engineers maintain your current checks? What happened the last time a dashboard was wrong?"
- **Respond:** in-house scripts only catch problems someone anticipated. Atlas learns baselines automatically and covers freshness, volume, schema and distribution changes.
- **Proof point:** reference the case study of a European logistics customer that retired 1,200 hand-written checks after moving to Atlas.

## 3. "We already use a monitoring tool for our infrastructure."

- **Explore:** "Does it tell you when a table has stopped updating or a column has suddenly become null?"
- **Respond:** infrastructure monitoring watches servers; Atlas watches the data itself. They are complementary, and Beacon can route Atlas alerts into the existing PagerDuty or Slack setup.

## 4. "Security will never approve a SaaS tool touching our data."

- **Explore:** "What does your security team usually require?"
- **Respond:** Atlas reads metadata and query statistics by default and does not copy row-level data. Share the security package (SOC 2 Type II report, pen test summary, DPA) through the trust portal after an NDA is signed.
- **Escalate:** bring a Sales Engineer and, for Enterprise deals, request a call with the Security team through #deal-desk.

## 5. "Now is not a good time."

- **Explore:** "What would need to change for this to become a priority?"
- **Respond:** connect to an upcoming event, such as a migration to a new warehouse, a regulatory audit or a board reporting deadline.
- **Next step:** agree on a specific follow-up date in Salesforce rather than "check back next quarter".

## 6. "We need it in our own cloud account."

- **Explore:** which regulation or policy drives the requirement.
- **Respond:** EU customers can use EU hosting in Frankfurt. Self-hosted deployment is not offered in 2026; do not promise it. Log the request in the "Product feedback" field in Salesforce so Product can track demand.

## Escalation contacts

- Pricing and deal structure: Deal Desk in #deal-desk.
- Technical objections: the regional Sales Engineering lead.
- Anything else: your Sales Director.
