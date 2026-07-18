# [TOOL-LIBRARY] Premium AI tool catalog, RBAC grants, guarded runs

## Why / design

Code-catalog vs DB-row split: `domain/tool-catalog.ts` (typed prompts + input
schemas, versioned in git) is the source of truth; the global `AiTool` row
exists only to carry the id that per-tenant `CompanyToolSetting`/`ToolGrant`
hang off. `ToolCatalogSyncService` (OnModuleInit) upserts by slug and deletes
stale rows — wrapped in try/catch so catalog sync NEVER blocks boot. The
catalog is global/unscoped (raw client); settings/grants are tenant-scoped.

## Features

Tool listing with per-caller visibility · per-tool access view (admin) ·
company enable toggle · per-user grants · guarded `POST /tools/:slug/run`.
Kinds: `PROMPT` (runnable) and `BUILTIN` (opens an in-app route via href).

## Business rules (`domain/tool-access.ts`)

- `canRunTool`: disabled → nobody; enabled → HR_ADMIN always, others need an
  individual grant. Distinct error messages for disabled vs not-granted.
- Admins see everything incl. disabled tools (to re-enable); others see only
  what they can run; BUILTIN hidden from non-admin listings.
- No settings row = enabled by default (`?? true`).
- Grants only for same-company MANAGER/EMPLOYEE; cross-tenant userIds are
  silently dropped by the scoped query.

## Prompt-guardrail gotchas (`domain/prompt-renderer.ts`)

- User documents go into the SYSTEM prompt as labelled XML blocks, NOT the
  user turn — the input guard caps the user turn at 4,000 chars. The user
  turn is a short plain HR request on purpose: meta phrasing ("follow your
  instructions") trips the injection classifier.
- `escapeBlock` escapes `</` so a pasted document can't close its own XML
  block and smuggle instructions.
- Input validation: unknown keys rejected; per-field cap (default 20k);
  required + select-option enforcement → 400.
- Offline (no key): inputs validate, run returns a synthetic "offline mode"
  message with `live:false`.

## Other gotchas

- Admin list view runs a per-tool grant-count query loop (N queries).
- `setEnabled` is find-then-update/create (upsert's unique where isn't
  expressible from ALS tenant context).
