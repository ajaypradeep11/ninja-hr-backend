# NinjaHR Multi-Tenancy — Design

Status: approved (Sections 1–3); Sections 4–5 as proposed. Date: 2026-07-10.

Turns NinjaHR from single-tenant (one `CompanySettings` singleton, one-time
signup) into multi-tenant: many companies sign up on one deployment, each
isolated by `companyId`, resolved per request from the logged-in user.

## Scope (MVP isolation)

In: signup creates a company + its admin; every record scoped by `companyId`;
clean session-derived URLs; one email = one company. Out (later): subdomains,
custom domains, users in multiple companies, billing.

## Section 1 — Data model

- **New `Company` model** (tenant root): `id`, `name`, `slug` (unique, for public
  careers URLs), `createdAt`.
- **`companyId` FK → `Company` on every tenant-owned table** (all ~40 models),
  **including child tables** (denormalized so the enforcement extension can scope
  any model directly). `@@index([companyId])` on each.
- **`CompanySettings`** stops being `id:'default'`; becomes **1:1 per company**
  (`companyId`). A `Company` row is what "a tenant exists" means.
- **`Employee.email` stays globally unique** → encodes one-email-one-company
  (matches Firebase's one-account-per-email). Global unique constraints that
  should be per-company become `@@unique([companyId, …])`.
- DB is empty → purely additive migration, `companyId` non-null from the start.

## Section 2 — Tenant context & automatic enforcement

- **`AsyncLocalStorage` tenant context** holds the request `companyId`; readable
  anywhere without threading through signatures.
- **Set in the auth layer:** `ActorGuard` reads `user.companyId`, puts it on
  `req.actor.companyId`, and runs the request inside `als.run({ companyId }, …)`.
- **Prisma Client Extension** enforces, reading `companyId` from ALS at query time:
  reads → merge `where:{companyId}`; `create/createMany` → stamp `data.companyId`;
  `update*/delete*/upsert` → add `companyId` to `where`.
- **Fail-closed:** a tenant-scoped model queried with no context **throws** — never
  a silent "return everything".
- **Escape hatches** (small, auditable): a **system client** (raw, unextended
  Prisma) + `runInTenant(companyId, fn)`, used only by signup, public careers by
  slug, and onboarding/candidate by-token.

## Section 3 — Auth, signup & tenant lifecycle

- **Signup creates a tenant** (one-time gate removed): each call creates a
  `Company` (name + auto unique slug), provisions the Firebase admin, and creates
  the founding `Employee` + `User` (HR_ADMIN), all stamped via `runInTenant`.
  `findUserByEmail` guard stays (enforces one-email-one-company). Slug from name,
  deduped with numeric suffix.
- **`ActorGuard` resolves `companyId`** from the resolved user (Firebase lane and
  internal-key/`x-actor-id` lane). Verified-email join still requires
  `email_verified` and carries the matched user's `companyId`. Persona-only
  fallback removed for tenant routes.
- **Cross-company impersonation blocked:** HR_ADMIN `x-actor-id` may only target
  a user with the same `companyId`.
- **Public/tenant-less routes resolve tenant explicitly:** `/careers/:slug`,
  onboarding/candidate by-token → look up `Company` → `runInTenant`. Health public.
- `RolesGuard` unchanged.

## Section 4 — Frontend / BFF

- **URLs stay clean** (`/admin`, `/employee`) — tenant is derived server-side from
  the session, so no per-tenant routing work. No `companyId` in headers on the
  session lane (backend derives it); the internal-key lane derives it from
  `x-actor-id`'s user.
- **Signup page** stays but is always available (each submit creates a new
  company). Fix the current crash: a closed/failed signup shows a friendly message
  instead of the raw Server-Components error.
- **Careers becomes per-company:** `/careers/[slug]` (+ `/careers/[slug]/[job]`);
  the careers/apply server actions pass the slug; backend resolves the company.
- Otherwise minimal change — the BFF already forwards the session.

## Section 5 — Migration, testing, rollout

- **Migration:** single additive Prisma migration (Company + `companyId` columns +
  per-company unique constraints). Applied in prod via the container's
  `prisma migrate deploy` on start.
- **Testing:**
  - Unit: Prisma extension (scopes reads, stamps writes, fail-closed on missing
    context), ALS context, signup-creates-tenant, same-company-only impersonation,
    careers-by-slug scoping.
  - e2e: two companies sign up; each sees only its own data across every context;
    cross-company id access 404/403s.
- **Rollout:** deploy backend (migration auto-runs), then frontend. Both via the
  existing push-to-main pipelines.

## Implementation phases

1. Schema: `Company`, `companyId` on all models, `CompanySettings` 1:1, unique
   constraints, migration.
2. Enforcement: ALS `TenantContext`, `runInTenant`, system client, Prisma
   extension, wire into the request lifecycle.
3. Auth: `ActorGuard` sets context + companyId; same-company impersonation guard.
4. Signup-creates-tenant; slug generation.
5. Public/token flows resolve tenant (careers by slug, onboarding/candidate token).
6. Frontend: careers slug routes; signup graceful error.
7. Tests (unit + e2e) and rollout.
