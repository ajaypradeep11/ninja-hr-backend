# Security & Infrastructure Review — ninja-hr-backend

**Date:** 2026-07-17 · **Scope:** auth guards, multi-tenancy, secrets/config, Docker/CI/deploy, AI endpoints, public surface. Frontend/BFF not reviewed.

## Remediation status (2026-07-17, same day)

| Finding | Status | Where |
|---|---|---|
| H1 live-DB footgun | ✅ Fixed | `live-db.guard.ts` blocks seed/e2e/`migrate dev|reset`/`db push` against live unless `DB_LIVE_CONFIRM=yes`. **Caught a real incident the same day**: `.env` had `DB_LIVE=true` and a routine `db:seed` was refused. |
| H2 no rate limiting | ✅ Fixed | `@nestjs/throttler` global 300/min/IP (trusted BFF lane exempt — see `AppThrottlerGuard`); signup 10/10 min, careers apply 20/10 min, health skipped; `trust proxy` set for Cloud Run XFF. |
| H3 key rotation | ✅ Fixed | `INTERNAL_API_KEY` accepts a comma-separated list (`validInternalKeys`/`matchesInternalKey`); prod boot asserts every listed key. |
| M1 CI test gate | ✅ Fixed | `test` job (npm ci, prisma generate, eslint check-only, jest) gates `deploy`. |
| M2 migrate-at-boot | ✅ Fixed | Runtime CMD is `node dist/main` only; CI updates+executes the `ninja-hr-migrate` Cloud Run job (ops image) before deploying. **One-time setup required** — see comment in `deploy.yml`. |
| M3 devDeps in runtime | ✅ Fixed | Two-target Dockerfile: `runtime` uses `npm ci --omit=dev` + dist only; `ops` keeps the toolchain for migrate/seed. |
| M4 webhook auth | ✅ Fixed | `InboundWebhookGuard`: scoped `INBOUND_WEBHOOK_SECRET` HMAC-SHA256 over the raw body (`x-webhook-signature`), trusted lane still accepted; route no longer needs the skeleton key. |
| M5 AI limiter bucket | ✅ Fixed | Anonymous bucket now per tenant (`anon:<companyId>`), not one global pool. |
| M6 backup hygiene | ⚠️ Partial | `backups/` chmod 700/600 + PII README. **Manual follow-ups:** encrypt/delete existing dumps; move live creds out of default `.env`. |
| L1 helmet | ✅ Fixed | `helmet()` (CSP off — JSON API; Swagger dev UI). |
| L2 forbidNonWhitelisted | ✅ Fixed | Unknown DTO fields now 400 (main.ts + e2e harness). |
| L3 password ≥10 | ✅ Fixed | Backend DTOs + accept-invite AND frontend forms/help text (both repos). |
| L5 `:latest` tag | ✅ Fixed | CI pushes SHA-pinned tags only. |
| L7 impersonation audit | ✅ Fixed | ActorGuard logs `IMPERSONATION real=… acting=…` per impersonated request (→ Cloud Logging). |
| L4 nested-write lint, L6 demo-endpoint flag | ⏳ Open | Low priority, unchanged. |

Verified after remediation: build + eslint clean, 380 unit tests and 71 e2e tests green (×2 runs), Docker images rebuilt.

## Summary

The auth and tenancy foundations are strong — noticeably better than typical for a project at this stage. The real risks are concentrated in **operational infrastructure**: a dev-laptop switch that points local tooling at the production database, a CI pipeline that deploys untested code, migrations running from app containers at boot, and missing rate limiting on the unauthenticated signup path.

### What's already done well

- **Guard chain fails closed** at every layer: `InternalKeyGuard` → `ActorGuard` → `RolesGuard`, with constant-time key comparison, and `ActorGuard` re-checking `req.trusted` so a guard-ordering regression can't silently honor client headers (`src/platform/auth/actor.guard.ts`).
- **Tenant isolation is enforced structurally**, not per-query: the Prisma extension throws if a tenant model is touched with no tenant in context — a missing context is a loud error, never "return everything" (`src/platform/database/tenant.extension.ts:44`). A dedicated `tenant-isolation.e2e-spec.ts` backs it.
- **Account-takeover paths were anticipated**: auto-link only on *verified* email (`actor.guard.ts:66`), signup refuses to adopt a Firebase identity linked to any workspace (`identity.controller.ts:75`), impersonation is HR-only, intra-tenant, and traceable via `realUserId`.
- **Production boot assertions** refuse weak `INTERNAL_API_KEY` or `FIREBASE_AUTH_DISABLED=1` (`src/main.ts:17`). Swagger is disabled in production.
- **Two-key control plane**: cross-tenant `/platform-admin` routes require a second secret (`PLATFORM_ADMIN_KEY`), fail closed when unset, constant-time compared.
- **CI is keyless** (Workload Identity Federation, no stored GitHub secrets); deploys are pinned to the commit SHA; the container drops root (`USER node`).
- **Secrets are not in git** (`.env` ignored, only `.env.example` tracked); `backups/` with PII is ignored.
- **AI endpoints are guarded**: input/output classifiers, blocklist, per-user sliding-window rate limiter, moderation log, red-team spec fixtures (`src/platform/ai/guardrails/`).

---

## Findings

### HIGH

#### H1. `DB_LIVE` switch points local dev tooling at the production database

`src/platform/database/resolve-db-env.ts` rewrites `DATABASE_URL`/`DIRECT_URL` for the **runtime, `prisma migrate`, and the seed** when `DB_LIVE=true` in a local `.env`. One flag flip and `npm run db:seed`, `prisma migrate dev`, or a destructive e2e run executes against Cloud SQL with real employee PII. The seed is described as idempotent, but it still writes demo rows into production, and `migrate dev` can offer to reset the database.

**Fix:** make live access opt-in per command, not ambient. At minimum: refuse to run the seed and e2e when the resolved URL matches `LIVE_DATABASE_URL` (a 5-line guard in `prisma/seed.ts` and the e2e setup); print a red banner and require an interactive confirmation (`DB_LIVE_CONFIRM=yes`) for anything except `start:dev`. Better: remove `LIVE_DATABASE_URL` from the laptop entirely and use the Cloud SQL Auth Proxy with short-lived IAM auth when live access is genuinely needed.

#### H2. Unauthenticated company signup has no rate limiting or abuse controls

`POST /identity/company-signup` is `@Public()` (`src/contexts/identity/interface/identity.controller.ts:70`) and there is no HTTP-level rate limiting anywhere (no `@nestjs/throttler`, nothing in `main.ts`). Anyone who can reach the Cloud Run URL can script unlimited company + Firebase-user creation: DB bloat, Firebase Auth quota/billing burn, and a directory of junk tenants. The 8 MB JSON body limit amplifies the cheap-write problem on the public apply route too (`resumeFileBase64` up to 6 MB, stored as `Bytes` in Postgres).

**Fix:** add `@nestjs/throttler` with a strict per-IP limit on `@Public()` routes and a sane global default (Cloud Run passes the client IP in `X-Forwarded-For`). For signup specifically, consider email-verification-before-provisioning or a CAPTCHA at the frontend plus an origin check here.

#### H3. Single shared `INTERNAL_API_KEY` is a full-trust skeleton key with no rotation story

A holder of the internal key can name any actor (`x-actor-id`, no role check), or take an HR_ADMIN persona in **any tenant** via `x-company-id` (`actor.guard.ts:129`). That is by design for the BFF — but the same key is shared with seeds and e2e, lives in plaintext `.env` on dev machines, and the guard accepts exactly one value, so rotation means a coordinated simultaneous redeploy of backend + frontend.

**Fix:** accept a comma-separated list of valid keys in `InternalKeyGuard` (checking each in constant time) so rotation is add-new → roll consumers → remove-old. Use a different key locally than in production (Secret Manager already planned per CLAUDE.md). Longer term, consider scoping: a separate, less-privileged key for seeds/e2e that cannot set `x-company-id`.

### MEDIUM

#### M1. CI deploys every push to `main` with zero verification

`.github/workflows/deploy.yml` checks out, builds, and deploys — it never runs `npm test`, lint, or `npm audit`. Combined with the commit-straight-to-main workflow, a broken or vulnerable change ships to production with no gate at all. There is also no container image scanning.

**Fix:** add a `test` job (`npm ci && npm run lint && npm test`) as a `needs:` prerequisite of `deploy`. Optionally add `npm audit --omit=dev --audit-level=high` and Artifact Registry's built-in vulnerability scanning.

#### M2. Migrations run from the app container at boot

`Dockerfile` CMD is `npx prisma migrate deploy && node dist/main`. On Cloud Run this means: (a) every cold-start instance attempts migration — concurrent instances can race (Prisma advisory-locks, but a lock-wait at scale-up stalls cold starts); (b) the **runtime** service account needs DDL privileges on the database forever, violating least privilege; (c) it contradicts the documented process ("`prisma migrate deploy` must be run against Cloud SQL separately", CLAUDE.md). A bad migration also turns into a crash-loop of the serving revision rather than a failed deploy step.

**Fix:** move migration to a dedicated step — a Cloud Run **job** (same image, command override `npx prisma migrate deploy`) executed by CI before `gcloud run deploy`, using a separate DB role with DDL rights. Drop the migrate from the serving CMD and drop DDL from the runtime DB user.

#### M3. Runtime image ships devDependencies

The runtime stage copies the full `node_modules` from the build stage (deliberately, for `tsx` + Prisma CLI). That ships the entire dev toolchain (eslint, jest, tsx, compilers) into the production container — larger attack surface, larger image, more CVE noise.

**Fix:** once M2 moves migrations out of the serving container, the runtime image needs neither the Prisma CLI nor tsx: add `RUN npm ci --omit=dev` in the runtime stage (plus the generated client). Keep a separate "ops" image target for migrate/seed if needed.

#### M4. Inbound-email webhook has no provider signature verification

`POST /recruitment/comms/inbound` (`recruitment.controller.ts:283`) authenticates via the internal key — the code comment acknowledges signature verification is deferred. As is, wiring a real mail provider means handing SendGrid/SES your full-trust internal key (see H3), or exposing the route publicly with only the guessable `reply+<token>` as protection. Forged inbound mail could inject attacker-controlled "candidate replies" into HR's view.

**Fix:** before connecting a real provider, implement its signing scheme (SendGrid Event Webhook signature / SNS message signature) in a dedicated guard for this route, mark it `@Public()`, and stop accepting the internal key there.

#### M5. AI rate limiter is per-process and in-memory

`SlidingWindowRateLimiter` (`src/platform/ai/guardrails/rate-limiter.ts`) keeps hits in a `Map`. On Cloud Run with N instances the effective limit is N×20/min, and every restart resets it. Also verify the key when `userId` is null (persona lane) — a shared or absent key would let all anonymous-persona callers pool or bypass the limit.

**Fix:** acceptable short-term; note it. If AI cost abuse becomes a concern, back it with Postgres (a `ModerationLog`-style counter) or set Cloud Run `max-instances` low enough that N×limit is tolerable. Ensure a null `userId` maps to a *blocking* default rather than a shared bucket.

#### M6. Production data hygiene on developer machines

`.env` on the laptop holds (per its own comments) the live database URL, live Anthropic/Gemini keys, and the production internal key, in plaintext; `backups/` holds unencrypted dumps that the repo's own `.gitignore` comment says contain **SIN and banking data**. A lost/compromised laptop is a full production breach + PII disclosure (PIPEDA-reportable in Canada).

**Fix:** encrypt backups at rest (e.g. `age`/`gpg` pipe in the backup script) and delete them when done; keep live credentials out of the default `.env` (separate `.env.live` loaded only by an explicit script, or fetch at use-time via `gcloud secrets versions access`). FileVault on the machine is the floor, not the fix.

### LOW

- **L1 — No security headers / CORS statement.** No `helmet`, no `enableCors` (`main.ts`). For a JSON API behind a BFF this is mostly fine (no CORS = cross-origin browser calls blocked by default), but add `helmet` for defense-in-depth (`X-Content-Type-Options` globally — today it's only set on the resume route — plus `Strict-Transport-Security` if not already added at the edge) and a one-line comment documenting that CORS-off is intentional.
- **L2 — `ValidationPipe` strips unknown fields silently.** `whitelist: true` without `forbidNonWhitelisted: true` (`main.ts:57`) means typo'd/extra fields vanish instead of erroring — masks client bugs and makes probing invisible.
- **L3 — Password policy is `@MinLength(8)` only** on company signup. No complexity or breached-password check; Firebase accepts what the backend sets. Consider zxcvbn-style scoring at the frontend and length ≥ 10 here.
- **L4 — Nested writes bypass tenant stamping by design.** Documented in `tenant.extension.ts` and handled explicitly at the known sites, but nothing *prevents* a future nested `create` from shipping unstamped. Consider a lint rule or a spec that greps repositories for nested creates on tenant models and asserts each sets `companyId`.
- **L5 — `:latest` tag pushed to Artifact Registry.** Deploys are SHA-pinned (good), so `latest` is unused risk surface; anything that ever pulls `latest` gets an unreviewed image. Drop the tag or ignore knowingly.
- **L6 — Demo/simulation endpoints live in production** (`simulate-reply`, HR-only). Harmless today; gate behind an env flag so demo affordances can't fabricate candidate communications in prod.
- **L7 — Impersonation is traceable but not audited.** `realUserId` rides the request, but no persistent audit record is written when HR impersonates via `x-actor-id`. Log impersonated requests (who, as-whom, route, timestamp) — HR tooling routinely needs this for compliance.

---

## Suggested order of attack

| # | Item | Effort |
|---|------|--------|
| 1 | H1 — seed/e2e guard against live DB + confirmation gate | ~1 h |
| 2 | M1 — test job gating deploy in CI | ~30 min |
| 3 | H2 — throttler on public routes + global default | ~1–2 h |
| 4 | H3 — multi-key acceptance for rotation | ~1 h |
| 5 | M2+M3 — migration job + slim runtime image | ~half day |
| 6 | M6 — encrypt backups, isolate live creds | ~1–2 h |
| 7 | M4 — webhook signature guard (before any real mail provider) | ~half day |
| 8 | Lows, opportunistically | — |
