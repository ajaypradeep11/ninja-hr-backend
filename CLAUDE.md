# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This is the backend half of NinjaHR (agentic HR SaaS for Canadian SMBs) — a
NestJS (DDD + CQRS) API that owns Postgres via Prisma. It has a sibling repo,
`ninja-hr-frontend/` (Next.js 15, App Router), which is pure frontend and
owns no database; every read/write from it goes through this API. The two
repos are normally checked out side by side under a shared parent folder but
are otherwise independent (`.git`, `package.json`, lockfiles, CI).

## Commands

```bash
npm i
npm run db:up             # start Postgres in Docker (waits until healthy)
npm run prisma:migrate    # apply migrations (dotenv -e .env -- prisma migrate deploy)
npm run prisma:generate   # regenerate Prisma client — required after schema changes / fresh clone
npm run db:seed           # idempotent demo data (safe to re-run)
npm run start:dev         # http://localhost:4000/api/v1/health, Swagger at /api/docs
npm run lint               # eslint --fix on src/ and test/
npm run format              # prettier --write
npm test                    # unit tests (jest, *.spec.ts colocated under src/)
npm run test:e2e            # HTTP e2e suite (test/*.e2e-spec.ts, jest --runInBand) — needs db:up + prisma:migrate + db:seed
```

Run a single test:

```bash
npx jest path/to/file.spec.ts                 # one unit test file
npx jest -t 'test name substring'              # by test name
npx jest --config ./test/jest-e2e.json --runInBand --testPathPattern 'onboarding\.e2e-spec\.ts$'
```

Firebase Auth locally (email/password sign-in for seeded demo users):

```bash
firebase emulators:start --only auth --project demo-ninjahr   # port 9099
npm run seed:auth        # signs every seeded user's work email up with demo-password
```
Set `FIREBASE_AUTH_EMULATOR_HOST=localhost:9099` and `FIREBASE_PROJECT_ID=demo-ninjahr`
in `.env`, or set `FIREBASE_AUTH_DISABLED=1` to skip auth entirely (dev/e2e
only — refused at boot in production, see `src/main.ts`). Demo login for any
seeded work email (e.g. `sarah.mitchell@company.ca`) is `demo-password`.

### Whole stack (with frontend)

`docker compose up --build` from the repo pair's parent directory runs
Postgres + a real Firebase Auth emulator + backend + frontend together, wired
and seeded to match. Sign in at `http://localhost:3000/login` with any
seeded work email / `demo-password`.

## Architecture

### DDD bounded contexts + CQRS

`src/contexts/<context>/` — one folder per bounded context (`identity`,
`onboarding`, `people`, `timeoff`, `recruitment`, `performance`,
`offboarding`, `workplace`, `platform`), each with the same four layers:

- `domain/` — entities, value objects, pure domain services (e.g. checklist
  rules, status transitions). No framework or Prisma dependency.
- `application/` — CQRS commands (`commands/*.command.ts`, one write
  operation each) and queries (`queries/*.query.ts`, one read each).
- `infrastructure/` — Prisma repository + mapper (domain ↔ persistence).
- `interface/` — NestJS controller + DTOs, the HTTP boundary for the context.

`src/shared-kernel/` holds cross-context primitives (`aggregate-root.ts`,
`province.ts`). `src/platform/` holds cross-cutting infra: `auth/` (guards),
`database/` (Prisma service, tenant context), `health/`.

Data model: one Postgres DB (`prisma/schema.prisma`), ~35+ models spanning
identity/HRIS (`Employee`, `User`), onboarding (`OnboardingCase`,
`ChecklistTask`, `CaseDocument`, `ConsentEntry`), recruitment (`Requisition`,
`Candidate`, ATS/scorecard models), performance (`PerformanceReview`, `Pip`),
training, offboarding, growth (`Goal`, `OneOnOne`, `Kudos`), and a `Company`
model that roots multi-tenancy. Migrations live in `prisma/migrations/`
(dated, sequential — `npm run prisma:migrate` applies them; never hand-edit
an already-applied migration).

### Multi-tenancy

Every tenant-scoped row hangs off `Company`. Tenant scoping is implicit, not
per-query: `src/platform/database/tenant-context.ts` holds the current
request's `companyId` in an `AsyncLocalStorage`, opened fresh per-request by
Express middleware in `main.ts` before the guard chain runs, then populated
by `ActorGuard` once it resolves the caller. A Prisma extension reads this
store to scope queries automatically. Tenant-less "escape hatch" flows
(public careers-by-slug, candidate track-by-token) call `tenant.run()`
explicitly. See `docs/superpowers/specs/2026-07-10-multi-tenancy-design.md`
for the full design rationale.

### Auth: two lanes, three guards

Global guards run in this order (`APP_GUARD` registration order in
`app.module.ts` matters — do not reorder):

1. **`InternalKeyGuard`** — the edge guard. Either a constant-time
   `x-internal-key` match (trusted server-to-server lane: the frontend's BFF,
   seed scripts, e2e tests — sets `req.trusted`) or a verified Firebase bearer
   token (`Authorization: Bearer …` — sets `req.firebaseUser`). Routes marked
   `@Public()` skip this.
2. **`ActorGuard`** — resolves the caller into a full `ActorContext`
   (`userId`, `employeeId`, `role`, `companyId`, `realUserId`) and sets the
   tenant. Trusted lane: `x-actor-id` header names the acting user directly
   (no role check — the BFF is trusted), falling back to a persona-only
   (`x-actor-persona: admin|employee`) legacy mode with no user identity.
   Firebase lane: resolves by `firebaseUid`, auto-links on first login by
   *verified* email only (unverified-email auto-link would allow account
   takeover), and allows `x-actor-id` impersonation only when the verified
   caller is `HR_ADMIN` and the target is in the same company (`realUserId`
   always carries the true caller so impersonation stays traceable).
3. **`RolesGuard`** — enforces `@Roles()` against the resolved actor.

`FIREBASE_AUTH_DISABLED=1` and weak/default `INTERNAL_API_KEY` are refused at
boot when `NODE_ENV=production` (`assertProductionConfig()` in `main.ts`) —
this backend has no other end-user auth, so either misconfiguration is a full
auth bypass.

### AI features

AI-labelled features (JD generation, candidate message drafting, HR
Co-Pilot) are served here (`@anthropic-ai/sdk`), which uses
`ANTHROPIC_API_KEY` when set and falls back to deterministic templates
otherwise.

## Deployment

Cloud Run + Cloud SQL (Postgres). Firebase App Hosting is Next.js-only and
cannot run this NestJS service. `prisma migrate deploy` must be run against
Cloud SQL separately (e.g. via the Cloud SQL Auth Proxy). CI:
`.github/workflows/deploy.yml` builds/pushes a Docker image and deploys on
every push to `main` (Workload Identity Federation, no stored secrets).
Prefer `--set-secrets` (Secret Manager) over `--set-env-vars` for
`INTERNAL_API_KEY` etc. Never set `FIREBASE_AUTH_EMULATOR_HOST` /
`FIREBASE_AUTH_DISABLED` in production.

## Conventions

- Tests are colocated `*.spec.ts` next to the code they test (domain
  services, mappers, guards); e2e specs live in `test/*.e2e-spec.ts`, one per
  bounded context plus `tenant-isolation.e2e-spec.ts` for cross-tenant checks.
- Design/planning docs for past features live under `docs/superpowers/{specs,plans}/`
  — check there for rationale before re-deriving it (e.g. multi-tenancy
  design, Firebase auth design).
