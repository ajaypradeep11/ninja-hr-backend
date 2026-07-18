# [PLATFORM-INFRA] src/platform — auth, tenancy, AI guardrails, DB services

Cross-cutting infrastructure. No business features live here.

## Why it exists

Every context needs the same four things — caller identity, tenant isolation,
guarded AI access, and safe DB plumbing — so they are solved once here and
consumed via DI, never re-implemented per context.

## Auth: two lanes, four global guards (auth/)

Registration order in `app.module.ts` is load-bearing — do not reorder:

1. `internal-key.guard.ts` — edge guard. Constant-time match against
   `INTERNAL_API_KEY` (comma-separated rotation list, `validInternalKeys()`)
   sets `req.trusted` — this happens even on `@Public()` routes so the
   throttler can exempt the BFF. Else a Firebase bearer/session-cookie is
   verified → `req.firebaseUser`. Else 401 (public routes pass).
2. `app-throttler.guard.ts` — per-IP limits, skipped when `req.trusted`
   (the BFF proxies all users from one egress IP; throttling it would pool
   everyone into one bucket). In-memory → limit is per-instance on Cloud Run.
3. `actor.guard.ts` — resolves `ActorContext` and sets the tenant.
   - Trusted lane: `x-actor-id` names any user, no role check (BFF is
     trusted); persona-only fallback (`x-actor-persona` [+ `x-company-id`])
     carries no user identity and, without the company hint, NO tenant.
   - Firebase lane: resolve by `firebaseUid`; first-login auto-link by email
     only when `email_verified` (unverified link = account takeover).
     `x-actor-id` impersonation only for HR_ADMIN, same company only,
     `realUserId` keeps the true caller, and each request logs an
     `IMPERSONATION real=… acting=…` audit line.
4. `roles.guard.ts` — enforces `@Roles()` against the resolved actor.

`inbound-webhook.guard.ts` — route-scoped guard for the mail webhook:
accepts `req.trusted` OR HMAC-SHA256 of the raw body (`x-webhook-signature`)
under `INBOUND_WEBHOOK_SECRET`. Raw bytes come from the `json({verify})` hook
in `main.ts`. Unset secret = lane disabled, not open.

`platform-admin.guard.ts` — second key (`PLATFORM_ADMIN_KEY`) for the
cross-tenant admin routes; fails closed when unset.

Production boot (`assertProductionConfig` in `main.ts`) refuses: missing/short
internal keys, the dev default key, or `FIREBASE_AUTH_DISABLED=1`.

## Tenancy (database/)

- `tenant-context.ts` — AsyncLocalStorage store; opened empty per request by
  middleware in `main.ts` BEFORE guards; `ActorGuard` calls `set()`.
- `tenant.extension.ts` — Prisma extension scoping every op on tenant models
  by `companyId`; throws if no tenant is set (fail closed, never "return
  everything"). UNSCOPED_MODELS: `Company`, `AiTool` (global catalog).
  **Nested writes are not intercepted** — `{ user: { create: … } }` must set
  companyId explicitly (see `scripts/repair-nested-tenant.ts` for the
  historical fallout).
- `prisma.service.ts` = raw/system client for cross-tenant lookups
  (firebaseUid, invite/portal tokens, slugs). `tenant-prisma.service.ts` =
  the scoped client every repository injects.
- `tenant-resolver.service.ts` — escape hatches for tenant-less flows:
  `runByCompanySlug` / `runByRequisitionSlug` / `runByPortalToken`.
- `live-db.guard.ts` — refuses seed/e2e/`migrate dev|reset`/`db push` against
  the live DB unless `DB_LIVE_CONFIRM=yes`. `resolve-db-env.ts` is the
  `DB_LIVE` URL switch it protects against.

## AI serving + guardrails (ai/)

`llm-provider.ts` — provider abstraction; Gemini or Anthropic per
`AI_PROVIDER_CHAT`; no key → deterministic offline fallback (`isLive()`
false), never a boot failure.

`guardrails/guarded-agent.service.ts` pipeline, in order: input guard
(length cap → per-user sliding-window rate limit, anonymous callers bucketed
per tenant `anon:<companyId>` → regex blocklist → LLM classifier) → provider
call with a canary token injected into the system prompt → output guard
(canary leak = prompt-injection refusal; persona-based PII rules) →
`moderation-log.service.ts` records every block. Classifier down = allow +
log, not block. Red-team fixtures: `guardrails/red-team.spec.ts`.

## Gotchas

- e2e (`test/e2e-utils.ts`) sets `FIREBASE_AUTH_DISABLED=1` before importing
  AppModule — FirebaseAdminService reads it at construction.
- `TenantPrismaService` is a constructor-returns-extended-client declaration
  merge — the class IS the extended client; don't "fix" the eslint-disabled
  lines.
- Swagger is dev-only middleware; the global guard does not cover it.
