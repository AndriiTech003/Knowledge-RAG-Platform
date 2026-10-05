---
title: Vendor Onboarding and Payment Procedure (FIN-PRO-002)
format: html
author: Elena Petrova
updated: 2026-04-08
---
# Vendor Onboarding and Payment Procedure (FIN-PRO-002)

| Field | Value |
|---|---|
| Procedure ID | FIN-PRO-002 |
| Version | 2.1 |
| Owner | Elena Petrova, Controller |
| Approver | Daniel Reyes, CFO |
| Audience | Finance Operations team (internal) |
| Effective date | 1 May 2026 |
| Parent policy | Procurement Policy (POL-FIN-005) |

## 1. Scope

FIN-PRO-002 is the internal Finance Operations procedure for setting up suppliers, matching invoices and paying them. It implements the company-wide Procurement Policy (POL-FIN-005), which defines who approves a purchase in Ramp Procurement. This procedure does not change those approval thresholds; it covers what happens after a purchase order exists. Employee expense claims in Expensify follow the Expense Policy (POL-FIN-001) and are out of scope.

## 2. Vendor onboarding

1. A new vendor is created in NetSuite by Finance Operations only after the Ramp purchase request is fully approved.
2. Required documents: completed vendor form, W-9 (US vendors) or VAT registration certificate (EU vendors), and bank details on company letterhead.
3. Bank details are confirmed by a **call-back to a phone number obtained independently** (not from the invoice or email).
4. Any later change of vendor bank details requires call-back verification by **two members of Finance Operations**, and the first payment after the change is limited to $10,000 until the vendor confirms receipt.
5. Vendors that will process customer data must have a completed Security vendor risk assessment attached in Ramp before the vendor record is activated.

## 3. Invoice processing

- All invoices are sent to ap@northwind.example and captured in NetSuite by the AP inbox automation.
- **Three-way match:** purchase order, goods receipt (confirmed by the requester in Ramp) and invoice must match within a tolerance of 2% or $500, whichever is lower.
- Invoices that fail the match are routed to the requester and the cost center owner, who have 5 business days to resolve the difference.
- Invoices without a valid PO number are returned to the vendor, as required by POL-FIN-005.

## 4. Payment terms and payment runs

- Default supplier terms follow POL-FIN-005: net 30 days from receipt of a valid invoice.
- Longer terms (net 45 or net 60) are negotiated by Procurement for contracts above $100,000 where possible, and recorded on the vendor record in NetSuite.
- Early payment discounts (for example 2/10 net 30) are taken when the annualized return exceeds 8%, at the Controller's discretion.
- **Payment runs are executed twice a month, on the 10th and the 25th** (or the previous business day). Invoices fully approved by the 7th or the 22nd are included in the next run.
- Urgent off-cycle payments need approval from the Controller and are limited to 4 per month.
- Payments are made by bank transfer in USD or EUR only. Each payment run above $250,000 in total requires release approval by the CFO in the banking portal.

## 5. Controls and reporting

| Control | Frequency | Owner |
|---|---|---|
| Duplicate invoice check (vendor, amount, date) | Every payment run | AP specialist |
| Vendor master data change log review | Monthly | Controller |
| Aged payables review | Weekly | Finance Operations lead |
| Dormant vendor clean-up (no activity 18 months) | Twice a year | Finance Operations |

Days payable outstanding (DPO) target for 2026: 32 to 38 days.

## 6. Exceptions

Exceptions to FIN-PRO-002 are requested in Jira (project FINOPS) and approved by the Controller. Questions: #finance-ops on Slack.
