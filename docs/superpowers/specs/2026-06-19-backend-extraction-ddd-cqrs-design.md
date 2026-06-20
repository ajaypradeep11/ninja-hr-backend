# NinjaHR — Backend Extraction to NestJS (DDD + CQRS)

**Date:** 2026-06-19
**Status:** Approved design — ready for implementation planning
**Repos:** `ninja-hr-frontend` (Next.js), `ninja-hr-backend` (NestJS, new)

---

## 1. Goal

Extract the application backend out of the Next.js full-stack app into a standalone
**NestJS** service built with **Domain-Driven Design + CQRS** (`@nestjs/cqrs`). The Next.js
app becomes a pure presentation layer that calls the backend over HTTP. The database
(Postgres) is owned by the backend.

The migration is **incremental** — the app stays working at every phase. The frontend's
view components (`*-view.tsx`) do not change behavior; only the internals of `lib/queries.ts`
and `app/actions/*` are rewritten from Prisma calls into HTTP calls.

### Non-goals (explicit out of scope)
- Real authentication / authorization. Personas (`Sarah Mitchell`, `Jim Scott`) stay
  hardcoded; a follow-up project adds real authn/z.
- Changing the database schema or data model.
- Restructuring into a pnpm/Turborepo monorepo (we keep two repos + a VS Code workspace).
- New product features.

---

## 2. Repo & workspace layout

Two independent git repos, tied together by a root multi-root VS Code workspace:

```
NinjaHR project/
├── ninja-hr.code-workspace      ← new (frontend + backend folders, shared settings/tasks)
├── ninja-hr-frontend/   (Next.js — presentation + generated API client)
└── ninja-hr-backend/    (NestJS — DDD/CQRS, owns Prisma + DB + docker)
```

The `.code-workspace` file includes both folders, shared editor/format-on-save settings,
the recommended ESLint/Prettier extensions, and tasks to run both dev servers.

---

## 3. Key decisions

| ID | Decision | Choice | Rationale |
|----|----------|--------|-----------|
| **A** | Frontend↔backend comms | **Server-side BFF.** Next Server Components & Server Actions call NestJS server-to-server over HTTP; the browser never calls the backend directly. | Preserves "no DB/secrets in browser" guarantee, no CORS, minimal change to views. |
| **B** | Contract sharing | **OpenAPI codegen.** NestJS publishes Swagger; frontend generates a typed client into `lib/generated/api`. | Backend DTOs = single source of truth; no type drift across repos. |
| **C** | Bounded contexts | **8 consolidated modules** (see §6). | Collapses thin CRUD areas; keeps contexts with real domain behavior distinct. |
| **D** | Auth (frontend→backend) | **Minimal:** shared internal API-key header + `X-Actor-Persona` header. | No real auth exists today; real authn/z is a separate follow-up. |
| **E** | Mutation responses | Return the **mutated resource** (REST-correct); frontend action wrappers do mutate-then-refetch to preserve current view behavior. | Avoids baking "return whole list" into the HTTP contract. |
| **F** | DB ownership | Backend owns Prisma schema, migrations, seed, `docker-compose.yml`, all `db:*` scripts. Frontend drops `@prisma/client`, `prisma`, `pg`, `server-only`. | Single writer to the DB; clean separation. |

---

## 4. Backend architecture (NestJS + `@nestjs/cqrs`)

Each bounded context is a Nest module with four layers:

```
src/
├── shared-kernel/            Province VO, compliance rules (from lib/compliance.ts),
│                             base classes (AggregateRoot, DomainEvent), Result type
├── platform/                 PrismaService, config, internal-auth guard, OpenAPI setup
└── contexts/<context>/
    ├── domain/               entities, value objects, domain events, domain services
    ├── application/
    │   ├── commands/         command + command handler  (mutations)
    │   ├── queries/          query + query handler       (reads)
    │   └── events/           domain-event handlers       (side effects, e.g. audit)
    ├── infrastructure/       Prisma repositories, enum mappers (from lib/db-map.ts)
    └── interface/            REST controllers + request/response DTOs (Swagger-decorated)
```

- **Commands** (mutations) dispatched via `CommandBus`: e.g. `CreateOnboardingCaseCommand`,
  `ApproveLeaveCommand`, `FinalizeTerminationCommand`.
- **Queries** (reads) dispatched via `QueryBus`: e.g. `ListOnboardingCasesQuery`,
  `GetLeaveRequestsQuery`.
- **Domain events** via `EventBus`: e.g. `OnboardingFinalizedEvent`, `CaseActivatedEvent`,
  `EmploymentTerminatedEvent`. Event handlers replace inline side effects (the current
  `auditLog.create(...)` calls become an audit event handler).
- Domain logic currently in `lib/onboarding.ts` (`nextStatus` state machine,
  `generateChecklist`, `generateSubmittedDocuments`) moves into the **Onboarding domain
  layer** (aggregate methods + domain services). `lib/compliance.ts` provincial rules move
  into the **shared kernel**.
- The current enum mapping in `lib/db-map.ts` becomes **infrastructure mappers** (one per
  context) translating between Prisma enums and domain/DTO shapes.

---

## 5. Frontend changes

- `lib/db.ts`, `lib/queries.ts`, `lib/db-map.ts`, `lib/onboarding.ts`, `lib/compliance.ts`,
  `prisma/`, `docker-compose.yml`, `prisma.config.ts` → **removed** (logic lives in backend).
- New `lib/api/` server-only HTTP client wrapping the generated OpenAPI client, attaching the
  internal API key + actor persona headers.
- `lib/queries.ts` functions are re-implemented as thin server-side `fetch` calls returning the
  **same DTO shapes** (so Server Components are unchanged).
- `app/actions/*.ts` Server Actions are re-implemented to call backend endpoints, then
  refetch as needed (decision E), keeping the same function signatures so client views are
  unchanged.
- The DTO types in `lib/data.ts` are replaced by (or re-exported from) the generated API types.
- Frontend `package.json` drops Prisma/pg/server-only; adds an `api:generate` script
  (OpenAPI → typed client) and a `predev` that points at the backend instead of running migrations.

---

## 6. Bounded contexts & function mapping

Current server functions map to the 8 contexts as follows.

### 6.1 Onboarding  *(richest — first vertical slice)*
- **Aggregate:** `OnboardingCase` (root) + ChecklistTask, CaseDocument, ConsentEntry, AuditEntry
- **Queries:** `listCases`, `getOnboardingPipeline` (aggregate read)
- **Commands:** `createCase`, `markForm`, `addConsent`, `finalizeSubmission`, `setChecklist`,
  `setTaskStatus`, `verifyDocument`, `togglePolicy`, `activate`
- **Domain:** status state machine (`nextStatus`/`settle`), checklist generation, submitted-doc
  generation, consent versioning; audit entries emitted via domain events.

### 6.2 People
- **Entities:** Employee, SalaryBenchmark
- **Queries:** `getEmployees`, `getEmployeeByName`, `getHeadcountByDept`, `getSalaryBenchmarks`
- **Commands:** none today (employee status is changed by Offboarding via an event — see 6.6)

### 6.3 TimeOff
- **Entity:** LeaveRequest
- **Queries:** `getLeaveRequests`
- **Commands:** `setLeaveStatus` (approve/deny), `createLeaveRequest`

### 6.4 Recruitment
- **Entities:** Requisition, Candidate
- **Queries:** `getRequisitions`, `getCandidates`
- **Commands:** `publishRequisition`, `setCandidateStage`

### 6.5 Performance
- **Entities:** PerformanceReview, Pip
- **Queries:** `getPerformanceReviews`, `getPips`
- **Commands:** `advanceReviewState` (`REVIEW_FLOW` state machine — domain logic), `issuePip`

### 6.6 Offboarding
- **Entity:** OffboardingTask
- **Queries:** `getOffboardingTasks`
- **Commands:** `setOffboardingTaskStatus`, `finalizeTermination`
- **Cross-context:** `finalizeTermination` sets `Employee.status = TERMINATED`. Handled by an
  `EmploymentTerminatedEvent` consumed by People (anti-corruption boundary), not a direct
  cross-context DB write.

### 6.7 Workplace  *(Benefits + Documents + Learning — catalog CRUD)*
- **Entities:** BenefitsCarrier, VaultDocument, TrainingCourse
- **Queries:** `getBenefitsCarriers`, `getVaultDocuments`, `getTrainingCourses`
- **Commands:** none today

### 6.8 Platform  *(Settings + Automation + CoPilot)*
- **Entities/services:** CompanySettings, AgentRun, CoPilot (Anthropic)
- **Queries:** `getSettings`, `getAgentRuns`, `askCoPilot` (AI read)
- **Commands:** `saveSettings`, `createAgentRun`, `setAgentRunStatus`
- **Note:** `askCoPilot` keeps the persona-based system prompts; `ANTHROPIC_API_KEY` and the
  "no live key → caller uses canned fallback" contract move to the backend.

---

## 7. HTTP API surface (illustrative)

REST, versioned under `/api/v1`, grouped by context. Examples:

```
GET    /api/v1/onboarding/cases
POST   /api/v1/onboarding/cases
POST   /api/v1/onboarding/cases/:id/checklist
POST   /api/v1/onboarding/cases/:id/tasks/:taskId/status
POST   /api/v1/onboarding/cases/:id/activate
GET    /api/v1/timeoff/leave-requests
POST   /api/v1/timeoff/leave-requests
PATCH  /api/v1/timeoff/leave-requests/:id/status
GET    /api/v1/people/employees
GET    /api/v1/people/headcount
...
POST   /api/v1/platform/copilot/ask
```

Swagger served at `/api/docs`; OpenAPI JSON consumed by the frontend's `api:generate`.

---

## 8. Migration sequencing

The app stays working at every phase. Each phase deletes the matching Prisma code from the
frontend as the context lands in the backend.

- **Phase 0 — Foundation**
  - Root `ninja-hr.code-workspace`.
  - ESLint (flat config) + Prettier in both repos; shared format settings.
  - NestJS skeleton: app module, `PrismaService`, config, internal-auth guard, Swagger.
  - Move Prisma schema, migrations, seed, `docker-compose.yml`, `db:*` scripts to backend.
  - Frontend `api:generate` wired; `/health` endpoint; both dev servers run from the workspace.

- **Phase 1 — First slice: Onboarding** (proves the full DDD/CQRS pattern end-to-end)
  - Onboarding module: domain (aggregate + state machine + checklist gen), application
    (commands/queries/events), infrastructure (Prisma repo + mappers), interface (controllers + DTOs).
  - Frontend onboarding `queries`/`actions` rewritten as HTTP calls; frontend onboarding
    Prisma code deleted.

- **Phases 2…8 — Remaining contexts** (one slice each):
  People, TimeOff, Recruitment, Performance, Offboarding, Workplace, Platform.
  Offboarding/People cross-context event wiring (6.6) lands with Offboarding.

- **Final — Cleanup**
  - Remove all Prisma/pg/server-only deps from the frontend.
  - Frontend is pure presentation + generated API client.

---

## 9. Testing strategy

- **Backend domain/application:** unit tests on aggregates, domain services (state machines,
  checklist/compliance rules), and command/query handlers (mock repositories).
- **Backend interface:** e2e tests per controller against a test database.
- **Contract:** OpenAPI spec generation verified in CI; frontend client regenerated and
  type-checked against it.
- **Frontend:** existing behavior preserved — Server Components/Actions point at a test/mock
  backend; views unchanged.
- Each phase is mergeable only when its context's tests pass and the app runs end-to-end.

---

## 10. Linting

- Both repos: ESLint flat config + Prettier, shared formatting rules.
- Backend: `@typescript-eslint` + Nest-friendly rules (decorators, DI).
- Frontend: `next lint` integrated with the shared Prettier config.
- Format-on-save + recommended extensions configured via `ninja-hr.code-workspace`.
