---
title: Discount Approval Matrix
format: html
author: Tom Lindqvist
updated: 2026-03-02
---
# Discount Approval Matrix

| Field | Value |
|---|---|
| Owner | Tom Lindqvist, VP Sales |
| Maintained by | Deal Desk (Revenue Operations) |
| Effective | 2 March 2026 |
| System | Salesforce CPQ approval workflow |

## 1. Purpose

This matrix defines who can approve a discount on an Atlas or Beacon quote. Discounts are measured against the list price in the current Atlas price book, on the **total first-year subscription value** of the quote. Approvals are captured automatically by the Salesforce CPQ approval workflow; email or Slack approvals are not valid.

## 2. Approval levels

| Discount off list price | Approver | Typical turnaround |
|---|---|---|
| 0% – 10% | Account Executive (no further approval) | Immediate |
| 10.1% – 20% | Sales Director of the region that owns the account | 1 business day |
| 20.1% – 30% | VP Sales (Tom Lindqvist) | 2 business days |
| Above 30% | VP Sales (Tom Lindqvist) and CFO | 3 business days, Deal Desk review required |

In short: AEs can discount up to 10% on their own, Sales Directors up to 20%, and anything above 20% needs the VP Sales, Tom Lindqvist.

## 3. Non-standard terms

Some terms require approval regardless of discount level:

| Term | Approver |
|---|---|
| Payment terms longer than net 30 | Deal Desk |
| Multi-year price lock longer than 3 years | VP Sales |
| Free months or ramped pricing | Sales Director |
| Custom liability cap or SLA credits above standard | Legal |
| Beacon included at no charge | VP Sales |

## 4. Rules

- Discounts for multi-year prepaid contracts are calculated per year; the deepest annual discount determines the approval level.
- Professional services may be discounted up to 15% by the AE; more requires Sales Director approval.
- Partner margins under the Partner Program are not customer discounts and do not count toward this matrix.
- Once approved, a discount is valid for 30 days. Expired quotes must be re-approved.
- Discount approvals must be obtained before the quote is sent to the customer (Stage 5 – Negotiation).

## 5. Escalation

If an approver is unavailable for more than the typical turnaround time, the request escalates automatically to the next level in Salesforce CPQ.
