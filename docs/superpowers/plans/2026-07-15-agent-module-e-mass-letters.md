# Module E — AI Letter Drafting + Mass Mail-Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add guarded single-employee letter drafting, deterministic cohort mail-merge, and human-approved bulk vault filing to the existing Letter Lab and Agent Runs surfaces.

**Architecture:** Letter generation remains owned by the `workplace` bounded context. A pure, server-side merge function renders trusted HRIS fields; `LetterDraftService` optionally sends that deterministic draft through Module B's `GuardedAgentService`; `MassLetterService` resolves a tenant-scoped cohort and creates one `AgentRun` with nested `AgentRunItem` rows. Bulk generation never files documents. The existing platform approval command delegates mass-letter runs to an exported `MassLetterApprovalService`, which files each pending item and updates it independently. The frontend only submits IDs/instructions and renders server results; it never decides cohort membership or performs the authoritative merge.

**Tech Stack:** NestJS 11, CQRS, Prisma 7, `TenantPrismaService`, raw `PrismaService` only for an explicitly tenant-checked per-item transaction, Module B `GuardedAgentService`, Jest, Supertest, Next.js 15 Server Actions, existing Letter Lab/Agents UI primitives, Playwright.

## Frozen Cross-Module Interfaces and Security Rules

- Module A owns `AgentRunItem` and the sole schema migration. **Do not add another migration.** Its frozen fields are `id`, `runId`, `employeeId`, `payload Json`, `status String`; `AgentRun.items` is the parent relation.
- `AgentRunItem` deliberately has no `companyId`. The tenant extension injects `companyId` into every top-level model operation, so top-level `TenantPrismaService.agentRunItem.*` calls fail. All normal reads/creates/status updates must be nested through tenant-scoped `agentRun` operations. The one raw-client transaction in Task 6 is allowed only after checking `run.companyId === TenantContext.companyId` and `employee.companyId === TenantContext.companyId` in the same transaction.
- Module B exports `GuardedAgentService.ask({ system, messages, persona, userId, maxTokens, temperature, otherEmployeeNames })`. It returns `{ text, verdict, live }`. Every AI rewrite in this module goes through it; never inject or call `LlmProvider` directly.
- A blocked personalized draft is returned as a refusal for the single-letter flow and becomes a `Failed` mass item. Provider-offline (`live: false`) is not failure: use the deterministic merge and mark `aiPersonalized: false`.
- `POST /workplace/letters/draft` is `HR_ADMIN` + `MANAGER`. A manager may target only an employee whose `manager` equals the verified actor's `employeeName`; return 404 for every unauthorized/cross-tenant target so existence is not leaked.
- `POST /workplace/letters/mass-issue` is `HR_ADMIN` only. Cohorts contain non-terminated employees in the current tenant. Manual IDs are re-resolved server-side; client-supplied employee data is never trusted.
- An `AgentRun` with items is the discriminator for a mass-letter run. Do not infer behavior only from the human-readable `intent` prefix.
- Run creation sets `AWAITING_APPROVAL`, `progress: 100`, `affected: item count`, and does **not** create `VaultDocument` rows. Only `PATCH /platform/agent-runs/:id/status` with `Completed` performs filing.
- Approval is one-way and idempotent at item level: process only `Pending`; never reissue `Issued`; per-item failures become `Failed`; the run ends `COMPLETED` even with failures, and its summary reports issued/failed counts.
- Letter bodies must actually be filed. Extend the existing issue mechanism with optional UTF-8 `content`; store it in `VaultDocument.data` with `mimeType: text/plain`, `size`, and a `.txt` name. Do not label plain text as PDF.
- Preserve unknown `{{merge_fields}}` verbatim. Known fields are substituted on the server. AI prompts explicitly require any remaining tokens to survive byte-for-byte.
- Mass payload shape is frozen for backend/frontend agreement:

```ts
export interface MassLetterPayload {
  employeeName: string;
  documentName: string;
  body: string;
  mode: 'save' | 'signature';
  aiPersonalized: boolean;
  error?: string;
  vaultDocumentId?: string;
}
```

- Never put salary, letter text, or instructions in `AgentRun.intent`/`summary`; those ledger fields contain counts/template name only. Item bodies are exposed only by the existing HR-admin-only Agent Runs endpoint.
- Mass personalization is capped at 100 employees and uses at most 3 concurrent guarded calls. Deterministic mass merge may handle up to 500 employees.
- The project uses a live PostgreSQL database; there is no local DB or Docker fallback. All unit tests must use mocks. Run build/lint/unit verification before any DB-backed command. Module E has no migration to apply; Module A's consolidated migration is deployed separately as an explicit, approved live-database step before Module E e2e. Never run `prisma migrate dev`, reset, seed, or destructive cleanup against the live database.

## File Map

```text
ninja-hr-backend/
  src/contexts/workplace/domain/
    letter-merge.ts                         # pure renderer + fallback draft
    letter-merge.spec.ts
    workplace.types.ts                     # draft/mass/payload contracts
  src/contexts/workplace/application/
    letters.handlers.ts                    # existing issue + new commands
  src/contexts/workplace/infrastructure/
    letter-draft.service.ts
    letter-draft.service.spec.ts
    mass-letter.service.ts
    mass-letter.service.spec.ts
    mass-letter-approval.service.ts
    mass-letter-approval.service.spec.ts
    workplace.repository.ts
  src/contexts/workplace/interface/
    dto/workplace.dto.ts
    workplace.controller.ts
  src/contexts/workplace/workplace.module.ts
  src/contexts/platform/domain/platform.types.ts
  src/contexts/platform/infrastructure/platform.mapper.ts
  src/contexts/platform/infrastructure/platform.repository.ts
  src/contexts/platform/application/commands/set-agent-run-status.command.ts
  src/contexts/platform/application/commands/set-agent-run-status.command.spec.ts
  src/contexts/platform/platform.module.ts
  test/agent-mass-letters.e2e-spec.ts
ninja-hr-frontend/
  lib/letters.ts
  lib/data.ts
  app/actions/letters.ts
  app/actions/modules.ts
  app/admin/letter-lab/letter-lab-view.tsx
  app/admin/agents/agents-view.tsx
  e2e/mass-letters.spec.ts
  lib/api/generated/openapi.d.ts             # regenerated, never hand-edited
```

---

### Task 1: Pure server-side merge engine and stable contracts

**Files:**
- Create: `src/contexts/workplace/domain/letter-merge.ts`
- Create: `src/contexts/workplace/domain/letter-merge.spec.ts`
- Modify: `src/contexts/workplace/domain/workplace.types.ts`

**Produces:** `renderLetterTemplate`, `fallbackLetter`, `DraftLetterInput/Result`, `MassLetterInput/Result`, `MassLetterPayload`, and cohort types. This replaces the frontend-only `lib/letters.ts::renderLetter` as the authoritative implementation.

- [ ] **Step 1: Write failing pure unit tests**

Cover all of the following:

1. substitutes `employee_name`, `title`, `department`, `start_date`, `salary`, `manager_name`, `employee_number`, `today`, and `company`;
2. uses `en-CA` human-readable dates and CAD salary formatting with a passed fixed `now` (tests never depend on the wall clock);
3. preserves an unknown token such as `{{bonus_amount}}` exactly;
4. escapes nothing and does not interpret replacement values containing `$&` (use a callback replacement, not a replacement string);
5. produces a useful employment-verification fallback when no template is supplied;
6. never includes SIN, banking, birth date, personal contact data, or any property not in the explicit merge record.

Run: `npx jest src/contexts/workplace/domain/letter-merge.spec.ts`
Expected: FAIL because the module does not exist.

- [ ] **Step 2: Add contracts to `workplace.types.ts`**

Use these shapes:

```ts
export type LetterKind =
  | 'cover'
  | 'employment_verification'
  | 'promotion'
  | 'probation'
  | 'custom';

export interface LetterMergeEmployee {
  id: string;
  name: string;
  title: string;
  department: string;
  province: string;
  hireDate: Date;
  salary: number;
  manager: string | null;
  employeeNumber: string | null;
}

export interface DraftLetterInput {
  employeeId: string;
  instructions: string;
  kind?: LetterKind;
  templateId?: string;
}

export interface DraftLetterResult {
  text: string;
  live: boolean;
  blockedCategory?: string;
}

export type MassCohort =
  | { type: 'all' }
  | { type: 'department'; value: string }
  | { type: 'province'; value: string }
  | { type: 'manual'; employeeIds: string[] };

export interface MassLetterInput {
  templateId: string;
  cohort: MassCohort;
  mode: 'save' | 'signature';
  personalizeWithAi?: boolean;
  instructions?: string;
}

export interface MassLetterPayload {
  employeeName: string;
  documentName: string;
  body: string;
  mode: 'save' | 'signature';
  aiPersonalized: boolean;
  error?: string;
  vaultDocumentId?: string;
}

export interface MassLetterResult { runId: string; affected: number }
```

- [ ] **Step 3: Implement the renderer**

`renderLetterTemplate(body, employee, companyName, now)` uses one allowlisted map and `/\{\{[a-z_]+\}\}/g`. Unknown tokens return themselves. `fallbackLetter(kind, employee, companyName, now)` returns a conservative plain-text skeleton and then passes it through the same renderer. No LLM logic belongs here.

- [ ] **Step 4: Run tests and commit**

Run: `npx jest src/contexts/workplace/domain/letter-merge.spec.ts && npm run lint`
Expected: PASS.

Commit: `git commit -m "feat(letters): add server-side merge engine and contracts"`

---

### Task 2: Make the existing issue path persist the rendered content

**Files:**
- Modify: `src/contexts/workplace/domain/workplace.types.ts`
- Modify: `src/contexts/workplace/interface/dto/workplace.dto.ts`
- Modify: `src/contexts/workplace/interface/workplace.controller.ts`
- Modify: `src/contexts/workplace/application/letters.handlers.ts`
- Modify: `src/contexts/workplace/infrastructure/workplace.repository.ts`
- Create or modify: `src/contexts/workplace/infrastructure/workplace.repository.spec.ts`
- Modify: `ninja-hr-frontend/app/actions/letters.ts`
- Modify: `ninja-hr-frontend/app/admin/letter-lab/letter-lab-view.tsx`

**Why this is required:** the current endpoint creates only vault metadata, while the UI previews a letter and names it `.pdf`. Approval would otherwise file an empty document.

- [ ] **Step 1: Write failing repository tests**

Assert that `issueLetter({ employeeId, name: 'Employment letter.txt', mode: 'save', content })`:

- tenant-scoped employee lookup returns 404 when absent;
- creates `VaultDocument` with `data: Buffer.from(content, 'utf8')`, `mimeType: 'text/plain'`, exact byte `size`, folder `05_HR_Letters`, access `EMPLOYEE`;
- uses type `Letter` for save and `Letter — Awaiting Signature` for signature;
- continues accepting calls with no `content` for backward compatibility;
- when actor role is manager, returns 404 unless the employee's `manager` equals `actor.employeeName`.

Run the focused spec and observe the content assertion fail.

- [ ] **Step 2: Extend the input and DTO**

Add `content?: string` (max 50,000 chars) to `IssueLetterInput` and `IssueLetterDto`. Pass `@ActorCtx() actor` from the controller into `IssueLetterCommand`; command/repository accept the actor for the manager ownership check. Do not trust a client-supplied manager name.

- [ ] **Step 3: Implement persistence and fix the current UI**

Store UTF-8 bytes only when content is supplied. In `GenerateModal.issue`, send `content: letterText` and use `${template.name} — ${selected.name}.txt`. Update the Server Action type accordingly.

- [ ] **Step 4: Verify**

Run backend focused tests, `npm run build`, and frontend `npm run build`.
Expected: the existing single-letter flow files readable text without breaking callers that omit content.

Commit: `git commit -m "fix(letters): persist issued letter content in employee vault"`

---

### Task 3: Guarded single-employee AI drafting endpoint

**Files:**
- Create: `src/contexts/workplace/infrastructure/letter-draft.service.ts`
- Create: `src/contexts/workplace/infrastructure/letter-draft.service.spec.ts`
- Modify: `src/contexts/workplace/interface/dto/workplace.dto.ts`
- Modify: `src/contexts/workplace/application/letters.handlers.ts`
- Modify: `src/contexts/workplace/interface/workplace.controller.ts`
- Modify: `src/contexts/workplace/workplace.module.ts`

**Consumes:** Module B `GuardedAgentService`; Module A/B `AiModule`; Task 1 renderer.

- [ ] **Step 1: Write failing `LetterDraftService` tests**

Use mocked `TenantPrismaService` and `GuardedAgentService`. Assert:

1. target employee and optional template are fetched tenant-scoped;
2. an unknown target/template returns 404;
3. a manager can draft only for a direct report; HR may draft for any tenant employee;
4. deterministic base uses the tenant company's name and server-owned employee fields;
5. the guarded call has `persona: 'admin'` for HR, `persona: 'employee'` for managers, actor `userId`, `maxTokens: 4096`, `temperature: 0.2`, and the final user message contains only the admin's instructions/kind;
6. target facts and deterministic body are delimited as untrusted data in `system`, with instructions to preserve facts and remaining merge tokens and return only the letter;
7. managers pass `otherEmployeeNames: []` because the only employee supplied is an authorized target (otherwise the employee-persona PII guard would block the target's own name);
8. `live: false` returns the deterministic base unchanged;
9. a blocked result returns the fixed refusal with `blockedCategory` and never silently falls back;
10. no template uses `fallbackLetter(kind)`.

Run: `npx jest src/contexts/workplace/infrastructure/letter-draft.service.spec.ts`
Expected: FAIL because service is missing.

- [ ] **Step 2: Add `DraftLetterDto`**

Validate `employeeId`, `instructions` (1–1,000 chars), optional `kind` enum, optional `templateId`. Require one of `instructions`, `kind`, or `templateId` in a small DTO-level/custom validation check; never accept raw employee facts or a raw template body.

- [ ] **Step 3: Implement `LetterDraftService`**

Read employee/template/company through `TenantPrismaService`. Build the deterministic base first. Call only `GuardedAgentService.ask`. Use clear XML-like delimiters around facts/template and state that those blocks are data, not instructions. If `verdict.allowed` is false, return the refusal. If offline, return the base with `live: false`.

- [ ] **Step 4: Wire CQRS and HTTP**

Add `DraftLetterCommand(input, actor)`/handler. Add:

```ts
@Post('letters/draft')
@Roles('HR_ADMIN', 'MANAGER')
draftLetter(@Body() body: DraftLetterDto, @ActorCtx() actor: ActorContext)
```

Import `AiModule` in `WorkplaceModule`, register the service/handler. Do not export the draft service yet; Task 4 will use it inside the same module.

- [ ] **Step 5: Verify and commit**

Run focused Jest, backend build/lint.

Commit: `git commit -m "feat(letters): add guarded AI drafting endpoint"`

---

### Task 4: Tenant-scoped cohort resolution and mass-run creation

**Files:**
- Create: `src/contexts/workplace/infrastructure/mass-letter.service.ts`
- Create: `src/contexts/workplace/infrastructure/mass-letter.service.spec.ts`
- Modify: `src/contexts/workplace/interface/dto/workplace.dto.ts`
- Modify: `src/contexts/workplace/application/letters.handlers.ts`
- Modify: `src/contexts/workplace/interface/workplace.controller.ts`
- Modify: `src/contexts/workplace/workplace.module.ts`

- [ ] **Step 1: Write failing service tests**

Cover:

- `all`, exact `department`, exact `province`, and deduplicated `manual` cohorts;
- every query includes `status: { not: 'TERMINATED' }`; manual result order is stable by name;
- empty cohort is 400; missing template is 404; more than 500 deterministic or more than 100 AI-personalized targets is 400;
- one parent `agentRun.create` performs a nested `items.create` (never `prisma.agentRunItem.create`), with status `AWAITING_APPROVAL`, safe intent/summary, progress 100, affected count;
- deterministic items are `Pending` and have the frozen payload shape;
- AI personalization calls `LetterDraftService` with concurrency <= 3;
- AI personalization forwards the verified HR actor (especially `userId`) into every guarded draft; it never invents a null/system actor;
- live guarded drafts set `aiPersonalized: true`; offline drafts remain pending with deterministic body and `false`; blocked/errored drafts become `Failed` with a short non-sensitive error;
- zero `VaultDocument` creates occur;
- instructions/body/salary never appear in run intent or summary.

Run the focused spec; expect module-not-found failure.

- [ ] **Step 2: Add nested validated DTOs**

Add `MassCohortDto` and `MassIssueLetterDto` with `@ValidateNested`/`@Type`. Enforce cohort type/value combinations, `employeeIds` max 500, optional instructions max 1,000, boolean personalization, and mode enum. Reject unknown properties through the existing global whitelist.

- [ ] **Step 3: Implement resolution and bounded personalization**

Resolve the template and employees from the tenant client. Use explicit `select` so only merge fields enter memory. Implement a tiny `mapWithConcurrency(items, 3, fn)` helper locally with unit coverage; do not add a dependency. Build all payloads, then create the parent and children in one nested Prisma create:

```ts
prisma.agentRun.create({
  data: {
    intent: `Mass letter: ${template.name} → ${items.length} employees`,
    status: 'AWAITING_APPROVAL',
    progress: 100,
    affected: items.length,
    summary: `${pending} ready for approval${failed ? `; ${failed} failed to generate` : ''}`,
    time: 'just now',
    items: { create: items.map(/* employeeId, payload, status */) },
  },
});
```

Nested creation is load-bearing because `AgentRunItem` has no `companyId`.

- [ ] **Step 4: Add endpoint**

Add `CreateMassLetterRunCommand(input, actor)` and:

```ts
@Post('letters/mass-issue')
@Roles('HR_ADMIN')
massIssue(@Body() body: MassIssueLetterDto, @ActorCtx() actor: ActorContext)
```

Return `{ runId, affected }` with HTTP 201. The name says `mass-issue` for approved API compatibility, but document clearly in code that it only queues.

- [ ] **Step 5: Verify and commit**

Run focused tests, build, lint.

Commit: `git commit -m "feat(letters): queue tenant-scoped mass mail-merge runs"`

---

### Task 5: Return nested item details from the Agent Runs API

**Files:**
- Modify: `src/contexts/platform/domain/platform.types.ts`
- Modify: `src/contexts/platform/infrastructure/platform.repository.ts`
- Modify: `src/contexts/platform/infrastructure/platform.mapper.ts`
- Create or modify: mapper/repository specs

- [ ] **Step 1: Write failing mapper/repository tests**

Assert `getAgentRuns()` calls `agentRun.findMany({ include: { items: { orderBy: { id: 'asc' } } } })`; this nested include is tenant-safe. Assert mapping returns `items` with `id`, `employeeId`, parsed frozen payload, and status `Pending | Issued | Failed`. Generic runs map to `items: []`.

- [ ] **Step 2: Add API types**

Add `AgentRunItemStatus`, `AgentRunItem`, and `items: AgentRunItem[]` to backend `AgentRun`. Keep existing top-level response fields unchanged.

- [ ] **Step 3: Implement include/mapping**

Validate JSON defensively in the mapper. Invalid historical payloads should map to a safe empty preview/error, not crash the entire ledger response. Do not add a top-level `agentRunItem` query.

- [ ] **Step 4: Verify and commit**

Run mapper/repository specs and build.

Commit: `git commit -m "feat(agents): expose nested mass-letter run items"`

---

### Task 6: Approval orchestration with per-item transactional filing

**Files:**
- Create: `src/contexts/workplace/infrastructure/mass-letter-approval.service.ts`
- Create: `src/contexts/workplace/infrastructure/mass-letter-approval.service.spec.ts`
- Modify: `src/contexts/workplace/workplace.module.ts`
- Modify: `src/contexts/platform/application/commands/set-agent-run-status.command.ts`
- Create: `src/contexts/platform/application/commands/set-agent-run-status.command.spec.ts`
- Modify: `src/contexts/platform/platform.module.ts`
- Modify: `src/contexts/platform/infrastructure/platform.repository.ts`

**Boundary decision:** `PlatformModule` imports `WorkplaceModule`; `WorkplaceModule` exports only `MassLetterApprovalService`. There is no reverse import, so no circular module dependency. Generic run updates remain in `PlatformRepository`.

- [ ] **Step 1: Write failing approval-service tests**

Test these invariants:

1. requires a non-null `TenantContext.companyId`;
2. raw lookup uses `{ id, companyId }` and includes items; a cross-tenant/missing run is 404;
3. accepts only a run with items and status `AWAITING_APPROVAL`; generic runs are reported as “not handled” to the platform handler;
4. claims the run with tenant-scoped `agentRun.updateMany({ where: { id, status: 'AWAITING_APPROVAL' }, data: { status: 'RUNNING' } })`; a zero count returns 409, preventing double-click concurrency;
5. skips `Issued` and pre-generation `Failed` items;
6. for each `Pending` item, a single raw Prisma transaction rechecks run and employee `companyId`, creates the text vault document, and updates the item to `Issued` with `vaultDocumentId` added to payload;
7. item transaction failure is caught, then a nested `agentRun.update({ data: { items: { update: ...Failed } } })` records a sanitized error and continues;
8. final parent update sets `COMPLETED`, progress 100, affected equal issued count, and summary with issued/failed counts;
9. retries never create a second vault document for an `Issued` item;
10. signature mode sets the existing awaiting-signature type.

The raw transaction is exceptional and must have assertions for every tenant predicate. Never use `raw.agentRunItem.findMany` without joining/checking the parent.

- [ ] **Step 2: Implement `MassLetterApprovalService.tryApprove(id)`**

Return `null` when the run has no items (generic platform flow should continue), otherwise return the refreshed run list or a small handled marker. Parse payload before claiming; malformed payload is marked failed rather than filed. The per-item transaction must:

- re-read `AgentRunItem` joined to `run` and require `run.companyId === companyId`;
- require employee `companyId === companyId`;
- create `VaultDocument` with explicit `companyId` because the raw client is unscoped;
- update the raw item only by its verified `id` in the same transaction.

This closes the crash window between vault creation and item status update.

- [ ] **Step 3: Extend the platform command without changing its route**

`SetAgentRunStatusHandler` behavior:

- status other than `Completed` → existing generic repository update;
- `Completed` → call `tryApprove(id)` first;
- handled mass run → return refreshed runs;
- no-item generic run → existing `setAgentRunStatus`.

Do not teach `PlatformRepository.setAgentRunStatus` to issue letters. Test both branches.

- [ ] **Step 4: Wire modules**

Export approval service from `WorkplaceModule`. Import `WorkplaceModule` in `PlatformModule`. Register no duplicate providers. Confirm Nest's dependency graph starts without a circular dependency.

- [ ] **Step 5: Verify and commit**

Run both focused specs, full backend Jest, build, lint.

Commit: `git commit -m "feat(letters): issue mass runs only after human approval"`

---

### Task 7: Letter Lab frontend — draft with AI and queue a cohort

**Files:**
- Modify: `ninja-hr-frontend/lib/letters.ts`
- Modify: `ninja-hr-frontend/app/actions/letters.ts`
- Modify: `ninja-hr-frontend/app/admin/letter-lab/letter-lab-view.tsx`

- [ ] **Step 1: Add frontend types and Server Actions**

Add `DraftLetterResult`, `MassCohort`, and mass input/result matching backend. Add typed `draftLetter()` and `queueMassLetters()` using the actor-aware admin client and the existing `unwrap` pattern. Do not call quick-ask/copilot from Letter Lab after this task.

- [ ] **Step 2: Replace the current AI customization call**

`GenerateModal.generate()` calls `/workplace/letters/draft` with `employeeId`, `templateId`, instructions, and kind/category. The returned text remains editable in the preview (use a textarea/editor rather than immutable `<pre>`), and issue sends that exact edited `content` with a `.txt` name. A blocked result renders the refusal and disables issue until the admin changes the request; offline result shows the deterministic-fallback note.

- [ ] **Step 3: Add the “Generate for many” flow**

Add a secondary action per template. Modal fields:

- cohort tabs: All / Department / Province / Select people;
- searchable manual multi-select;
- save vs signature mode;
- optional “Personalize each with AI” toggle, off by default;
- instructions shown only when personalization is on;
- exact resolved client-side estimate with a warning that the server is authoritative;
- confirmation text: “Nothing is filed until an HR admin approves this run.”

On success, show affected count and link to `/admin/agents`. Do not optimistically claim letters were issued.

- [ ] **Step 4: Frontend component tests/manual QA and commit**

At minimum run `npm run lint`, `npm run build`, and manually verify keyboard/focus/disabled/loading/error states at desktop and mobile widths.

Commit: `git commit -m "feat(letter-lab): add guarded drafts and cohort mail-merge UI"`

---

### Task 8: Agents frontend — expandable previews and explicit approval

**Files:**
- Modify: `ninja-hr-frontend/lib/data.ts`
- Modify: `ninja-hr-frontend/app/actions/modules.ts`
- Modify: `ninja-hr-frontend/app/admin/agents/agents-view.tsx`

- [ ] **Step 1: Extend frontend run types**

Mirror `AgentRunItem` and frozen payload. Keep `items: []` for generic runs. Regenerated OpenAPI types in Task 9 become the source of truth for actions.

- [ ] **Step 2: Implement expandable run detail**

“Review” expands/collapses the selected run and shows employee name, status badge, mode, AI-personalized marker, failure message, and a scrollable plain-text preview. Never render letter text with `dangerouslySetInnerHTML`.

- [ ] **Step 3: Make approval explicit and robust**

For a mass run, Approve opens a confirmation with pending/failed counts and states that it files to employee vaults. Disable both approval buttons while in flight. On response, replace the complete run list. If backend returns 409, refresh/list runs and show “already being processed” rather than retrying blindly. Generic existing approvals keep their current behavior.

- [ ] **Step 4: Verify and commit**

Run frontend lint/build and manual responsive QA.

Commit: `git commit -m "feat(agents): review and approve mass-letter run items"`

---

### Task 9: E2E, OpenAPI regeneration, and integration verification

**Files:**
- Create: `test/agent-mass-letters.e2e-spec.ts`
- Create: `ninja-hr-frontend/e2e/mass-letters.spec.ts`
- Regenerate: `ninja-hr-frontend/lib/api/generated/openapi.d.ts`

- [ ] **Step 1: Add key-free backend e2e**

With a stubbed/offline provider and two tenants, prove:

1. draft endpoint deterministically renders a same-tenant employee and persists nothing;
2. manager cannot draft for a non-report;
3. HR queues a department cohort; response/run contains only current-tenant, non-terminated employees;
4. cross-tenant manual IDs do not enter the run;
5. before approval, employee vault counts are unchanged;
6. approval creates readable text documents, changes items to Issued, and completes the run;
7. repeated approval creates no duplicates;
8. one bad employee/item becomes Failed while other items issue;
9. another tenant cannot fetch or approve the run;
10. blocklist refusal on AI personalization never produces an unsafe pending item.

Use real HTTP role guards and actor headers, not direct service calls.

The suite must use dedicated, uniquely prefixed test tenants/records in the live PostgreSQL environment and clean up only rows whose IDs it created. Do not truncate shared tables, reset the schema, invoke a seed script, or assume transaction rollback can span HTTP requests. Gate the suite behind an explicit environment flag such as `RUN_LIVE_DB_E2E=1`; without it, the suite is skipped with a clear message.

- [ ] **Step 2: Perform the controlled live-schema prerequisite**

Module E creates no migration. Before DB-backed e2e, confirm Module A's consolidated migration is committed and code/unit checks are green. After explicit authorization to connect to the live development database, inspect status with a read-only command:

```bash
npx prisma migrate status
```

If the migration is pending, stop and obtain explicit authorization for the live deployment, then run only the repository's deploy command (`npm run prisma:migrate`, which maps to `prisma migrate deploy`). Never use `prisma migrate dev`, `prisma db push`, `prisma migrate reset`, or Docker/local-DB setup. Record the deployed migration name and verify status again before continuing.

- [ ] **Step 3: Regenerate OpenAPI**

Start the backend against the configured live development environment only after the controlled schema prerequisite, then from `ninja-hr-frontend` run:

```bash
npm run api:generate
```

Remove any `as never` casts introduced temporarily for these endpoints once generated types exist. Never hand-edit `openapi.d.ts`.

- [ ] **Step 4: Add Playwright flow**

Cover: open Letter Lab → choose a uniquely prefixed test template → Generate for many → choose dedicated test employees → leave AI off → queue → visit Agents → Review previews → Approve → statuses become Issued/Completed. Also assert the confirmation copy and that no “issued” success appears before approval. Gate this live-data flow behind the same explicit flag and delete only artifacts created by the test.

- [ ] **Step 5: Full verification**

First run all DB-free checks:

Backend:

```bash
npm test
npm run build
npm run lint
```

Frontend:

```bash
npm run lint
npm run build
```

After schema status is confirmed and live-DB execution is explicitly authorized, run only the scoped integration suites:

```bash
RUN_LIVE_DB_E2E=1 npm run test:e2e -- --runInBand test/agent-mass-letters.e2e-spec.ts
cd ../ninja-hr-frontend && RUN_LIVE_DB_E2E=1 npm run test:e2e -- e2e/mass-letters.spec.ts
```

Expected: all pass and cleanup confirms no test artifacts remain. Do not run the entire e2e suite against shared live data unless separately authorized. Live Gemini tests are not required for this module; Module B owns opt-in live red-team coverage.

- [ ] **Step 6: Final commit**

Commit: `git commit -m "test(letters): cover mass generation approval and vault filing"`

## Final Acceptance Checklist

- [ ] No Module E Prisma migration exists; Module A remains the only owner of the six-model migration.
- [ ] No top-level tenant-client `AgentRunItem` operation exists.
- [ ] Every raw Prisma access includes explicit run/employee `companyId` checks.
- [ ] Single and mass AI drafting both call `GuardedAgentService`, never `LlmProvider`.
- [ ] Offline mode produces deterministic drafts; blocked mode never silently issues.
- [ ] Mass queue creation produces no vault documents.
- [ ] Only HR approval files mass letters, with per-item failure isolation and no double issue.
- [ ] Filed vault documents contain the exact reviewed/generated text.
- [ ] Managers cannot target non-reports; manual cohorts cannot smuggle cross-tenant IDs.
- [ ] Run ledger metadata contains no salary, instructions, or letter bodies.
- [ ] Frontend clearly distinguishes queued, pending, issued, and failed states.
- [ ] Backend/frontend builds, full tests, tenant e2e, and Playwright flow are green.
