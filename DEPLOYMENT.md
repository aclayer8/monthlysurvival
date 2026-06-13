# Deployment Plan

## Recommended First Online Target

Use Vercel for the first online deployment because this is a Next.js app and Vercel keeps the operational surface small.

Repository:

```text
https://github.com/aclayer8/monthlysurvival
```

Build settings:

```text
Framework: Next.js
Install command: npm ci
Build command: npm run build
Output: Vercel default
```

## Important MVP Limitation

The current app is local-first. Browser storage is not a shared database.

That means an online deployment will load the app anywhere, but financial data may still live per browser/device unless the user imports a JSON/CSV backup or we add a shared data layer.

## Safe Online Path

1. Push the app source to GitHub.
2. Deploy to Vercel as a private operational preview.
3. Keep using JSON export as backup after every important update.
4. Add one durable sync option before treating the online app as the primary source of truth:
   - Google Sheet API sync
   - Supabase/Postgres
   - SQLite on a small VPS with authentication
5. Add authentication before exposing the app outside personal use.

## Security Notes

- No bank API, card API, OAuth, or production secrets are required for the current MVP.
- Keep `.env*` ignored.
- Do not commit real credentials, account numbers, card numbers, access tokens, claim documents with sensitive personal data, or payroll slips.
- If Google Sheet sync is added, use least-privilege OAuth scopes and keep credentials in environment variables or a managed secret store.

## Rollback

Vercel can roll back to an earlier deployment from the Deployments page.

For data, use the latest exported JSON/CSV bundle from the app.

## Next Production Decisions

- Choose data persistence: Google Sheet sync vs database.
- Choose authentication: Vercel password protection, Cloudflare Access, or app-level login.
- Decide whether wife view is read-only.
- Decide whether imported/exported data should be encrypted at rest.
