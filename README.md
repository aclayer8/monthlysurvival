# Monthly Survival

Local-first Next.js web app for Tao's month-to-month family cashflow workflow.

## Goal

The app is designed to answer the practical survival questions first:

- Is this month safe?
- How much real cash is available now?
- How much can be spent per day?
- What bills, cards, and debts are still waiting for payday?
- What company expense, claim, or OT item needs review?

## Core Rules

- Daily Transaction is the source of truth for real cash movement.
- Wallet balances only change when a cleared Daily Transaction uses a wallet or cash.
- Credit card charges increase card liability, but do not reduce wallet cash immediately.
- Card payments reduce both the paying wallet and the card outstanding balance.
- Company Expense and OT are forecast money until the actual reimbursement or salary/OT payment is recorded.
- JSON/CSV export is the safety net before any future Google Sheet or database sync.

## Current MVP

- Next.js local web app
- Dracula-style dark theme for night use
- No auth yet
- No bank/card API integration
- Manual import/export first
- Google Sheet or database sync can be added later

## Run Locally

```powershell
npm.cmd install
npm.cmd run dev
```

Open:

```text
http://localhost:3000
```

## Useful Commands

```powershell
npm.cmd run typecheck
npm.cmd run build
```

## Data Safety Notes

- Do not commit `.env*`, logs, build output, or local exports.
- Do not store real bank credentials, card numbers, API keys, or passwords in this repo.
- Treat online deployment as private until authentication and durable storage are added.
