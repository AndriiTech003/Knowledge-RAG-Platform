---
title: IT Setup Guide
format: html
author: Jonas Weber
updated: 2026-03-02
---
# IT Setup Guide

This guide helps you set up your Northwind laptop and accounts on your first day. It takes about 60 minutes. IT Operations runs a live setup session every Monday at 10:00 Lisbon time and 10:00 Austin time for new joiners; you can also follow these steps on your own. If you get stuck, post in **#it-help** and include your laptop serial number.

## 1. Your laptop

| Role | Standard laptop | Refresh cycle |
|---|---|---|
| Engineering, Data, Product Design | MacBook Pro 14" (M4 Pro, 36 GB RAM) | Every 3 years |
| All other roles | MacBook Air 13" (M4, 16 GB RAM) | Every 4 years |
| Windows users (on request, with manager approval) | Lenovo ThinkPad X1 Carbon | Every 4 years |

Every employee also receives a USB-C hub, a headset (Jabra Evolve2 55) and a laptop sleeve. Office-based employees find an external monitor at every hot desk. Additional peripherals can be requested in #it-help.

Laptops are enrolled automatically in device management (Kandji for macOS, Intune for Windows) the first time you connect to the internet. Do not erase the laptop or create a second local account.

## 2. Activate Okta (single sign-on)

Okta is our single sign-on: you log in to Google Workspace, Slack, Jira, GitHub, Workday, Expensify, Salesforce and Notion through Okta.

1. Open the "Activate your Northwind Okta account" email sent to your personal address the evening before you start. The link is valid for **7 days**.
2. Choose a password of at least 14 characters (see POL-SEC-014 in the Information Security Policy).
3. Install **Okta Verify** on your phone and scan the QR code. Okta Verify with number matching is the only allowed second factor; SMS is not supported.
4. Sign in to the Okta dashboard at northwind.okta.example. All your apps appear as tiles.

If the activation link has expired, ask in #it-help; IT will send a new one after verifying your identity on a video call.

## 3. Password manager

Install the 1Password app from Kandji Self Service and sign in with the invitation in your Northwind mailbox. Store every work password in your private 1Password vault. Shared team credentials live in team vaults, which your manager can grant.

## 4. Connect to the network

- In the office, connect your laptop to **NW-Corp** with your Okta credentials. Personal phones use **NW-Staff**.
- Outside the office, the **Tailscale** VPN connects you to internal tools. It starts automatically and signs in through Okta.

## 5. Install your tools

Install apps only from Kandji Self Service (macOS) or Company Portal (Windows). The standard set is installed for you: Chrome, Slack, Zoom, Google Drive for desktop, 1Password, CrowdStrike Falcon and Tailscale. Engineers additionally get Docker Desktop, iTerm2 and a GitHub access request.

## 6. Check that your laptop is compliant

Open the device portal at devices.northwind.example. Your laptop should show a green "Compliant" status, which means disk encryption is on, the screen lock is set to 5 minutes and the operating system is up to date. Non-compliant laptops lose access to Google Workspace after 72 hours.

## 7. Getting help

| Problem | What to do |
|---|---|
| Account or access issue | #it-help, "Access request" workflow |
| Laptop broken or damaged | #it-help; a replacement is shipped within 2 working days |
| Laptop lost or stolen | Report in #security-help within 1 hour (POL-SEC-030) |
| Urgent issue outside office hours | Call the IT hotline +351 21 000 4410 |

IT Operations answers #it-help between 08:00 and 20:00 Lisbon time and 08:00 to 18:00 Austin time on working days.
