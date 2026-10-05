---
title: Quote-to-Cash Process in Salesforce
format: html
author: Tom Lindqvist
updated: 2026-05-11
---
# Quote-to-Cash Process in Salesforce

**Owner:** Revenue Operations (Deal Desk)
**Executive sponsor:** Tom Lindqvist, VP Sales
**Systems:** Salesforce Sales Cloud, Salesforce CPQ, DocuSign, NetSuite (billing)

This page describes every step from building a quote to handing a signed order to billing. Follow it for all new business, expansion and renewal deals for Atlas and Beacon.

## Step 1 – Build the quote in Salesforce CPQ

1. From the opportunity (Stage 4 – Business Case or later), click **New Quote**.
2. Select the price book: *Atlas 2026 USD* or *Atlas 2026 EUR*. The currency follows the account billing country.
3. Add products by SKU, for example `ATL-ENT-ANNUAL` (Atlas Enterprise, annual), `ATL-GRW-ANNUAL` (Atlas Growth, annual) or `BCN-ADDON-ANNUAL` (Beacon add-on, annual).
4. Enter quantity, term (12, 24 or 36 months) and start date.

## Step 2 – Approvals

- Discounts trigger the CPQ approval workflow according to the Discount Approval Matrix.
- Non-standard legal terms are flagged with the **Legal Review** checkbox and routed to Legal.
- Quotes cannot be generated as PDF while an approval is pending.

## Step 3 – Generate and send the order form

1. Generate the order form PDF from CPQ using the template for the region (NA or EMEA). German-language templates are available for DACH accounts.
2. Send via DocuSign directly from Salesforce. Do not send order forms as email attachments.
3. Quotes are valid for 30 days from generation.

## Step 4 – Countersignature and Closed Won

1. When the customer signs, DocuSign routes the order form to the Deal Desk for countersignature by an authorized signatory.
2. Deal Desk checks: signed version matches the approved quote, billing contact present, PO number captured if the customer requires one.
3. Only Deal Desk can move the opportunity to **Closed Won**. AEs cannot set this stage themselves.

## Step 5 – Handoff to billing

- Closed Won opportunities sync to NetSuite overnight (02:00 Lisbon time) through the Salesforce–NetSuite connector.
- Finance Operations issues the first invoice within 3 business days of Closed Won.
- Standard customer payment terms are net 30; anything longer requires Deal Desk approval.

## Step 6 – Provisioning

- The Atlas tenant is provisioned automatically when the subscription becomes active in NetSuite.
- Beacon add-on activation is triggered by the `BCN-ADDON-ANNUAL` line.

## Common errors

| Error message in CPQ | Cause | Fix |
|---|---|---|
| "Price book mismatch" | Quote currency differs from account billing country | Change the price book or correct the account billing country |
| "Approval required" | Discount above the AE's limit | Submit for approval; wait for CPQ approval |
| "Missing billing contact" | No contact with role Billing on the opportunity | Add a billing contact before generating the order form |

Questions: #deal-desk on Slack.
