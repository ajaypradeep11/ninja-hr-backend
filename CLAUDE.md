# CLAUDE.md — ninja-hr-backend

NestJS (DDD + CQRS) API for NinjaHR, an agentic HR SaaS for Canadian SMBs.
Owns Postgres via Prisma. Sibling repo `ninja-hr-frontend/` (Next.js 15) is a
pure frontend — every read/write comes through this API.

## [COMMANDS]

```bash
npm i
npm run db:up             # local Postgres in Docker (waits until healthy)
npm run prisma:migrate    # apply migrations
npm run prisma:generate   # regenerate Prisma client (after schema change / fresh clone)
npm run db:seed           # idempotent demo data
npm run start:dev         # http://localhost:4000/api/v1/health, Swagger /api/docs
npm run lint              # eslint --fix
npm test                  # unit tests (*.spec.ts colocated under src/)
npm run test:e2e          # test/*.e2e-spec.ts — needs db:up + migrate + seed
npx jest path/to/file.spec.ts        # single file
```

Firebase Auth local: emulator on 9099 (`FIREBASE_AUTH_EMULATOR_HOST`) or
`FIREBASE_AUTH_DISABLED=1` (dev/e2e only; refused at boot in production).
Seeded demo login: any seeded work email / `demo-password`.

## [SAFETY] Live-DB interlock — read before any DB command

`.env` may have `DB_LIVE=true`, which points DATABASE_URL (runtime + migrate +
seed + e2e) at the **production** Cloud SQL DB. Destructive tooling (`db:seed`,
e2e, `migrate dev|reset`, `db push`) refuses to run against live unless
`DB_LIVE_CONFIRM=yes` (`src/platform/database/live-db.guard.ts`). For local
work: `DB_LIVE=false npm run db:seed`. Never set the confirm flag unprompted.

## [ARCHITECTURE] Layout + sector index

Each bounded context under `src/contexts/<name>/` has four layers — `domain/`
(pure rules, no framework), `application/` (one command/query class per
operation), `infrastructure/` (Prisma repo + mapper), `interface/` (controller
+ DTOs) — and its own CLAUDE.md with features, business rules, and design
rationale. Read the context file before working in it:

| Sector | Path | One-liner |
|---|---|---|
| [IDENTITY] | `src/contexts/identity/` | company signup, users, /me |
| [ONBOARDING] | `src/contexts/onboarding/` | cases, checklists, invites, consents |
| [PEOPLE] | `src/contexts/people/` | HRIS: employees, org, comp benchmarks |
| [TIMEOFF] | `src/contexts/timeoff/` | leave requests, balances, provincial rules |
| [RECRUITMENT] | `src/contexts/recruitment/` | ATS, public careers, candidate portal, AI drafting |
| [PERFORMANCE] | `src/contexts/performance/` | reviews, PIPs, goals/1:1s/kudos |
| [OFFBOARDING] | `src/contexts/offboarding/` | separation board, termination guard |
| [WORKPLACE] | `src/contexts/workplace/` | manager workspace views |
| [PLATFORM] | `src/contexts/platform/` | HR Co-Pilot chat, policies, moderation |
| [PLATFORM-ADMIN] | `src/contexts/platform-admin/` | cross-tenant admin console (2nd key) |
| [TOOL-LIBRARY] | `src/contexts/tool-library/` | premium AI tool catalog + RBAC + guarded runs |
| [PLATFORM-INFRA] | `src/platform/` | auth guards, tenancy, AI guardrails, DB services |

`src/shared-kernel/` = cross-context primitives. `prisma/schema.prisma` =
single DB, ~50 models, all tenant-scoped rows hang off `Company`.

## [INVARIANTS] Cross-cutting rules (details in src/platform/CLAUDE.md)

- **Auth**: three global guards in fixed order — InternalKeyGuard (edge:
  internal key OR Firebase bearer) → AppThrottlerGuard → ActorGuard (resolves
  ActorContext + tenant) → RolesGuard. Never reorder the APP_GUARD array.
- **Tenancy**: implicit per-request via AsyncLocalStorage + Prisma extension;
  fails closed. Nested writes are NOT auto-stamped — set companyId explicitly.
  Tenant-less flows (careers, portal tokens) use TenantResolver escape hatches.
- **Rate limits**: untrusted lanes throttled per-IP; trusted internal-key lane
  exempt. AI runs additionally guarded (input/output classifiers + limiter).
- **Secrets**: `INTERNAL_API_KEY` is a comma-separated rotation list. Webhook
  lane uses scoped `INBOUND_WEBHOOK_SECRET` HMAC, never the internal key.

## [DEPLOY]

Cloud Run + Cloud SQL. CI (`.github/workflows/deploy.yml`) on push to main:
lint+tests gate → build SHA-pinned `runtime` (slim serve-only) and `-ops`
(prisma CLI) images → run migrations via `ninja-hr-migrate` Cloud Run job →
deploy. Serving container never migrates at boot. Secrets via Secret Manager
(`--update-secrets`, NOT `--set-secrets` — set replaces the whole list; that
mistake once left prod serving 17-deploy-old code). Never set
`FIREBASE_AUTH_DISABLED` / emulator vars in production.

## [CONVENTIONS]

- Tests colocated `*.spec.ts`; e2e per context in `test/` plus
  `tenant-isolation.e2e-spec.ts`.
- Commit and push directly to `main` — no branches/PRs unless asked.
- Design docs with rationale: `docs/superpowers/{specs,plans}/`; security
  review + remediation log: `docs/security-infra-review-2026-07-17.md`.
