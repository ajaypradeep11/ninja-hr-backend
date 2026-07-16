---
name: verify
description: Build/launch/drive recipe for verifying ninja-hr-backend changes at the HTTP surface
---

# Verifying ninja-hr-backend

## Gotchas first

- `.env` may have `DB_LIVE=true` (live Supabase). **Never migrate/seed live.**
  Override per-command: `DB_LIVE=false npm run prisma:migrate` — the flag is
  resolved in-process by `src/platform/database/resolve-db-env.ts`, and
  dotenv-cli does not overwrite already-set shell vars, so no `.env` edit needed.
- Port 4000 is often occupied by the user's own dev server. Run the
  verification instance on another port: `DB_LIVE=false PORT=4100 npx nest start`.

## Boot

```bash
npm run db:up                          # docker Postgres (container testhr-pg, port 5433)
DB_LIVE=false npm run prisma:migrate
npm run prisma:generate
DB_LIVE=false npm run db:seed          # idempotent demo data
DB_LIVE=false PORT=4100 npx nest start # background; health at /api/v1/health
```

## Drive (trusted lane — no Firebase needed)

Headers: `x-internal-key: dev-internal-key` + `x-actor-id: <User.id>`.

Get seeded actor ids:

```bash
docker exec testhr-pg psql -U postgres -d testhr -t -A -F' | ' \
  -c 'SELECT id, role, "companyId" FROM "User" ORDER BY role;'
```

Base URL `http://localhost:4100/api/v1`. Useful surfaces: `platform/conversations`
(+ `/:id/messages`), `platform/copilot/ask`, `platform/policy-documents`,
`platform/moderation-events` (HR_ADMIN only), `platform/agent-runs`,
`workplace/letters/draft`, `workplace/letters/mass-issue` (HR_ADMIN only).

DB inspection: `docker exec testhr-pg psql -U postgres -d testhr ...`
(quote camelCase columns: `"companyId"`).

## Known offline (no GEMINI_API_KEY) behaviors — not bugs

- Chat replies "AI is not configured…" but still includes the live-record snapshot.
- `copilot/ask` returns `{"text":"","live":false}` (pre-existing contract).
- Policy upload is refused with 503 "handbook ingestion requires GEMINI_API_KEY" (per plan C).
- Letter draft falls back to deterministic templates with `live:false`.
- Input-guard classifier fails open (profanity blocklist still blocks deterministically).
