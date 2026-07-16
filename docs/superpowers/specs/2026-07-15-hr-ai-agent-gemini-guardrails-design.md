# HR AI Agent on Gemini — Provider Abstraction, Guardrails, Policy RAG, Chat, Mass Letters

**Date:** 2026-07-15
**Status:** Approved design, pending implementation plan
**Repos touched:** `ninja-hr-backend` (most work), `ninja-hr-frontend` (chat page, policies admin UI, mass-letter UI)

## Goal

One guarded HR AI agent, on Gemini, serving both consoles:

- **Employees:** ask HR questions answered from (a) their own live records ("how many
  sick days do I have left?") and (b) the company's uploaded employee manual, with
  citations ("can I take bereavement leave?"). General work assistance (brainstorming,
  presentation outlines) within HR/workplace scope.
- **Admins:** the same, across the whole workspace, plus letter drafting (cover,
  employment, custom HR letters) and **mass letter generation** (mail-merge over an
  employee cohort, queued for one-click approval).
- **Everyone:** heavy guardrails — no sexual content, no profanity/harassment, no
  coding or other out-of-scope tasks, no jailbreaks — enforced in layers, audited.

## Non-goals

- Migrating existing Anthropic-backed features (JD generator, message drafter,
  résumé parser, current quick-ask copilot backend). They keep working unchanged;
  the provider abstraction merely makes later migration cheap.
- Multi-document knowledge bases, cross-handbook search, or pgvector. One handbook
  per tenant, plain-table storage (decision below).
- Streaming responses (decision below — output guardrails require the full text).
- Emailing letters to employees; "mass generation" files letters into each
  employee's existing document vault via the existing issue mechanism.

## Decisions made (with rationale)

| Decision | Choice |
|---|---|
| Gemini adoption | Provider abstraction; only the new agent runs on Gemini. Existing Anthropic features untouched. |
| Policy knowledge | Admin uploads handbook → chunk → embed → RAG retrieval with citations. |
| Guardrails | Layered: input classifier + Gemini `safetySettings` + output filter. All three, always. |
| Chat UX | New full-page `/assistant` (multi-turn, persisted) **and** keep the Cmd-K quick-ask drawer. |
| RAG storage | Plain `PolicyChunk` Prisma table, embeddings as `Float[]`, in-app cosine similarity. No pgvector: corpus is one small handbook per tenant (hundreds of chunks max) and Cloud SQL needs no new extension. Swappable later. |
| Streaming | **No.** The output guard must scan the complete response before the user sees any of it; streaming would leak unfiltered prefixes. Non-streaming with a bounded timeout (same pattern as `copilot.service.ts`'s 20s cap, raised to 60s for long-form drafting). |
| PDF ingestion | No parser library. Handbook PDFs go to Gemini as `inlineData` (`application/pdf`) for text extraction — same "model is the parser" pattern as `resume-parser.service.ts`. Plain text / markdown paste also accepted. |

### Verified facts this design depends on (checked 2026-07-15)

- SDK: **`@google/genai`** — `ai.models.generateContent` / `embedContent`,
  `config.systemInstruction`, `config.safetySettings`.
- Models (stable IDs, env-overridable): chat **`gemini-3.5-flash`**, guardrail
  classifier **`gemini-2.5-flash-lite`**, embeddings **`gemini-embedding-2`**.
- `HarmBlockThreshold.BLOCK_LOW_AND_ABOVE` is the strictest blocking tier;
  blocked prompts surface via `promptFeedback.blockReason`.
- `HARM_CATEGORY_JAILBREAK` is **not available** in the Gemini API (Vertex-only) —
  our own injection detection in the input guard is required, not belt-and-braces.
- Existing reusable backend surface: `GET/POST/PATCH/DELETE /workplace/letter-templates`,
  `POST /workplace/letters/issue`, `AgentRun` model + `/platform/agent-runs` endpoints,
  tenant scoping via `TenantPrismaService`, persona/actor plumbing via `ActorGuard`.

## Architecture

Five modules. Build order = dependency order:

```
A. LlmProvider abstraction ──┬─► B. Guardrails ──┐
   (foundation, lands first) ├─► C. Policy RAG ──┼─► D. Chat agent + UX
                             └─► E. Mass letters ┘   (composes B + C + A)
```

All backend code follows the existing DDD/CQRS layout. New code lives in the
existing `platform` bounded context (`src/contexts/platform/`) except where noted,
because the agent is cross-context infrastructure like the current copilot.

---

## Module A — LLM provider abstraction + Gemini client

**Where:** `src/platform/ai/` (new cross-cutting infra folder, sibling of
`src/platform/auth/` and `src/platform/database/`).

```ts
// src/platform/ai/llm-provider.ts
export interface LlmMessage { role: 'user' | 'assistant'; content: string }
export interface LlmRequest {
  system: string;
  messages: LlmMessage[];
  maxTokens: number;
  temperature?: number;
  /** Provider-native safety level; 'strict' maps to BLOCK_LOW_AND_ABOVE on Gemini. */
  safety?: 'strict' | 'default';
  /** Optional inline document (handbook PDF extraction). */
  document?: { base64: string; mimeType: string };
}
export interface LlmResult {
  text: string;
  /** Set when the provider itself refused/blocked (e.g. promptFeedback.blockReason). */
  blocked?: { reason: string };
}
export interface LlmProvider {
  complete(req: LlmRequest): Promise<LlmResult>;
  embed(texts: string[]): Promise<number[][]>;
  /** False when no API key is configured — callers use their template fallbacks. */
  isLive(): boolean;
}
```

- **`GeminiProvider`** implements this on `@google/genai`. Key read at call time
  (`GEMINI_API_KEY`), models from `GEMINI_MODEL` (default `gemini-3.5-flash`),
  `GEMINI_CLASSIFIER_MODEL` (default `gemini-2.5-flash-lite`),
  `GEMINI_EMBED_MODEL` (default `gemini-embedding-2`). Bounded timeout, 1 retry,
  errors logged and degraded to `isLive() === false` behavior — exactly the
  `copilot.service.ts` resilience pattern.
- **`AnthropicProvider`** is a thin wrapper over the existing usage so future
  migrations are a DI swap; **no existing service is rewritten in this project**.
- NestJS DI token `LLM_PROVIDER_CHAT` resolved from `AI_PROVIDER_CHAT` env
  (default `gemini`). Registered in a new `AiModule` imported by `PlatformModule`.
- Classifier calls (Module B) go through a second method-level model parameter
  rather than a second provider instance: `complete(req, { model: 'classifier' })`
  is *not* added to the interface — instead `GeminiProvider` exposes
  `classify(system, text): Promise<string>` behind a narrow `LlmClassifier`
  interface, so the core interface stays vendor-neutral.

**Fallback behavior (no `GEMINI_API_KEY`):** chat answers with a deterministic
"AI is not configured; here is what I can tell you from your records" template
(reusing the snapshot), letters fall back to template merge only, handbook
ingestion is refused with a clear message. Nothing crashes; mirrors every
existing AI feature.

---

## Module B — Guardrails layer

**Where:** `src/platform/ai/guardrails/`. A single entry point wraps every agent call:

```ts
export interface GuardVerdict {
  allowed: boolean;
  category?: 'sexual' | 'harassment_profanity' | 'violence_illegal'
           | 'self_harm' | 'off_topic_coding' | 'off_topic_other'
           | 'prompt_injection' | 'pii_leak' | 'provider_blocked';
  refusalMessage?: string;  // category-specific, user-facing
}
export class GuardedAgentService {
  /** Runs input guard → model (strict safety) → output guard. */
  ask(input: GuardedAskInput): Promise<GuardedAskResult>;
}
```

### Stage 1 — input guard (before any model tokens are spent)

1. **Deterministic fast-fail** (no LLM, microseconds):
   - Profanity/slur blocklist (word-boundary regex, curated list checked into
     `guardrails/blocklist.ts`; catches the obvious cases cheaply and works even
     with no API key).
   - Message length cap (4k chars) and per-user rate limit (in-memory sliding
     window, 20 messages/min) — abuse and cost control.
2. **LLM classifier** (`gemini-2.5-flash-lite`, ~100 output tokens, JSON mode):
   labels the message `allowed | sexual | harassment_profanity | violence_illegal
   | self_harm | off_topic_coding | off_topic_other | prompt_injection`.
   The classifier prompt defines scope: *HR, workplace, this company's policies,
   the user's employment data, general workplace-document drafting and
   brainstorming are in scope; writing/debugging code, and anything unrelated to
   work, is out of scope.* Conversation context (last 2 turns) is included so
   follow-ups classify correctly.
   - Classifier unavailable/errors → **fail closed for generation, fail open for
     wording**: the message is answered only from the deterministic path
     (blocklist-clean messages proceed, but the event is logged `classifier_down`).
     Rationale: hard-down Gemini would otherwise take the whole agent down twice.

### Stage 2 — provider-native safety

Every generation call runs with `safetySettings` at `BLOCK_LOW_AND_ABOVE` for all
four supported harm categories (harassment, hate speech, sexually explicit,
dangerous content). A `promptFeedback.blockReason` result maps to
`provider_blocked` with the generic refusal message.

### Stage 3 — output guard (after generation, before the user sees anything)

Deterministic scans over the complete response:
- **System-prompt leak:** canary token embedded in the system prompt; if it (or
  large verbatim system-prompt substrings) appears in output → refuse + log.
- **Cross-employee PII (employee persona only):** output is scanned for names of
  *other* employees in the tenant (list already available from the snapshot
  query); a hit → redact-and-refuse. Admin persona skips this check.
- **Blocklist re-scan:** same profanity list as stage 1.

### Refusals, auditing, self-harm

- Each category has a fixed, respectful refusal string (e.g. off-topic-coding:
  *"I'm NinjaHR's HR assistant, so I can't help with writing code — but I'm happy
  to help with HR questions, your leave, policies, or drafting workplace
  documents."*). `self_harm` refusals additionally include Canadian crisis
  resources (Talk Suicide Canada 1-833-456-4566 / 9-8-8) — an HR tool must handle
  this category with care, not a generic refusal.
- Every block (any stage) writes a **`ModerationEvent`** row: tenant, userId,
  stage, category, truncated input hash (not full text — don't warehouse abuse
  content), timestamp. Admin-visible read endpoint
  `GET /platform/moderation-events` (`HR_ADMIN` only) for oversight.
- Guardrails wrap **all** new agent surfaces (chat, quick-ask when it moves to
  the guarded path, letter drafting, mass-merge drafting). One choke point.

**Testing:** a red-team fixture file (`guardrails/red-team.fixtures.ts`) with
representative prompts per category — explicit sexual asks, slurs, "write me a
Python script", "ignore your instructions and…", disguised/indirect variants —
asserted to refuse in unit tests (classifier mocked) and exercised for real in an
opt-in e2e that runs only when `GEMINI_API_KEY` is present.

---

## Module C — Policy handbook RAG

**Where:** backend `src/contexts/platform/` (application/infrastructure layers);
frontend admin page `app/admin/settings/policies` (or a `Policies` tab in
Settings — final placement decided in the plan against the existing Settings IA).

### Data model (new Prisma models)

```prisma
model PolicyDocument {
  id         String        @id @default(cuid())
  companyId  String
  company    Company       @relation(fields: [companyId], references: [id], onDelete: Cascade)
  title      String        // e.g. "Employee Manual 2026"
  sourceType String        // 'pdf' | 'text'
  status     String        // 'Processing' | 'Ready' | 'Failed'
  uploadedAt DateTime      @default(now())
  chunks     PolicyChunk[]
  @@index([companyId])
}
model PolicyChunk {
  id         String         @id @default(cuid())
  documentId String
  document   PolicyDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)
  companyId  String         // denormalized for tenant-scoped retrieval
  ordinal    Int            // position in document, for citation ("§14")
  heading    String?        // nearest section heading, for citation display
  text       String
  embedding  Float[]        // gemini-embedding-2 vector
  @@index([companyId])
}
```

### Ingestion (admin-only)

1. Admin uploads a PDF or pastes text (`POST /platform/policy-documents`,
   `HR_ADMIN`, multipart or JSON). Replacing the handbook deletes the previous
   document's chunks (one active handbook per tenant, v1).
2. PDF → text via Gemini (`inlineData`, extraction prompt returning
   markdown with headings preserved). Text/markdown accepted verbatim.
3. Chunking: split on headings, then paragraphs, targeting ~1,500 chars per chunk
   with 200-char overlap; each chunk records its nearest heading.
4. `embed()` in batches → store. Status `Processing → Ready` (ingestion runs
   async after the upload request returns, matching the platform's tolerance for
   background-ish work; failures set `Failed` with a retry button).

### Retrieval (inside the agent pipeline)

- Embed the user's question (1 call), load the tenant's chunk vectors, in-app
  cosine similarity, take top-5 above a floor (tuned in implementation; start 0.5).
- Injected into the prompt as a `POLICY EXCERPTS` block, each excerpt tagged
  `[title § heading]`. System prompt instructs: answer policy questions **only**
  from excerpts, cite the section inline, and if no excerpt covers the question
  say the handbook doesn't address it — never invent policy.
- No handbook uploaded → the agent says so and suggests the admin upload one
  (admins get the direct pointer to the Policies page).

---

## Module D — Chat agent + UX

### Backend

New Prisma models:

```prisma
model Conversation {
  id        String        @id @default(cuid())
  companyId String
  company   Company       @relation(fields: [companyId], references: [id], onDelete: Cascade)
  userId    String        // owner — conversations are strictly per-user
  title     String        // auto-generated from first message
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
  messages  ChatMessage[]
  @@index([companyId, userId])
}
model ChatMessage {
  id             String       @id @default(cuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  role           String       // 'user' | 'assistant'
  content        String
  blockedCategory String?     // set when this turn was refused (audit trail in-thread)
  createdAt      DateTime     @default(now())
  @@index([conversationId])
}
```

Endpoints (platform context, standard guard chain):
- `GET /platform/conversations` / `POST /platform/conversations` /
  `DELETE /platform/conversations/:id` — always scoped to the calling user
  (owner check on top of tenant scoping; admins have no special read access to
  other users' conversations — chats are private).
- `POST /platform/conversations/:id/messages` — the main turn endpoint. Pipeline:
  1. persist user message;
  2. **Guardrails stage 1** (Module B) — refusal short-circuits, persisted as an
     assistant message with `blockedCategory`;
  3. build context: persona-scoped live tenant snapshot (reuse/extract the
     existing `copilot.service.ts` snapshot builder — it moves to a shared
     `SnapshotService` so quick-ask and chat share one implementation, including
     leave-balance math for "how many sick days do I have left?");
  4. RAG retrieval (Module C) when the tenant has a handbook;
  5. `LlmProvider.complete()` with strict safety, last 20 messages of history,
     `maxTokens` 4096 (long-form drafting needs room);
  6. **Guardrails stage 3**, persist assistant message, return it.
- The existing `POST /platform/copilot/ask` (quick-ask) is **rewired internally**
  to the same guarded pipeline (stateless, short-answer system variant) so both
  surfaces share guardrails, snapshot, and RAG; its request/response contract is
  unchanged so the drawer keeps working without frontend changes.

System prompt: evolves `SYSTEM_BASE` — same persona split (admin: workspace-wide;
employee: own-data-only), same "not legal advice" and destructive-action rules,
plus: HR/workplace scope definition (mirrors the classifier's), citation
instructions for policy excerpts, and long-form permission (chat) vs 1–3
sentences (quick-ask). Employee-persona snapshot stays strictly self-scoped —
this remains the primary data-access guardrail, enforced by *what data the model
is given*, not by asking the model to behave.

### Frontend

- **`/assistant`** under both consoles (`app/admin/assistant`,
  `app/employee/assistant`; shared view component, persona from the shell).
  Standard pattern: server `page.tsx` fetches conversation list; client
  `assistant-view.tsx` renders thread + composer, calls Server Actions
  (`app/actions/assistant.ts`). Sidebar entry added in `lib/nav.ts` for both
  consoles. Refusals render as distinct quiet system-style bubbles.
  Markdown rendering for assistant messages (letters/outlines need formatting).
- **Quick-ask drawer:** unchanged UI; benefits from the guarded backend rewire.

---

## Module E — Letters & mass mail-merge

Reuses the existing Letter Lab and Agent Runs end-to-end; net-new pieces only:

1. **AI letter drafting** (single employee): a "Draft with AI" action in Letter
   Lab — admin describes the letter (or picks a type: cover, employment
   verification, promotion, probation…), backend endpoint
   `POST /workplace/letters/draft` (`HR_ADMIN` + managers, same roles as
   `letters/issue`) composes: guarded pipeline (Module B) + the target employee's
   record + optional template body → returns a draft with `{{merge fields}}`
   preserved. Admin reviews/edits in the existing editor, then issues via the
   existing `letters/issue`. Fallback (no key): plain template merge, as today.
2. **Mass generation:** admin picks a letter template + cohort (all employees /
   by department / by province / manual multi-select) →
   `POST /workplace/letters/mass-issue` creates an **`AgentRun`**
   (intent: `Mass letter: <template> → <N> employees`, status `Awaiting Approval`)
   plus per-employee merge results stored in a new `AgentRunItem` table
   (`runId`, `employeeId`, `payload Json` — the rendered letter, and
   `status`: `'Pending' | 'Issued' | 'Failed'`).
   Merge is deterministic field substitution (name, title, department, dates,
   salary…) — **AI is optional per-run** ("personalize with AI" flag routes each
   letter through the guarded draft endpoint; off by default for speed/cost).
3. **Approval:** the existing Agents page shows the run; approving it
   (existing `PATCH /platform/agent-runs/:id/status` flow, extended handler)
   issues every item into each employee's document vault via the existing issue
   command; per-item failures mark that item `Failed` without sinking the run.
   This honors the standing rule: the agent **queues** bulk actions, a human
   approves them.

New Prisma model: `AgentRunItem` (as above). `AgentRun` itself is unchanged.

Frontend: cohort-picker + "Generate for many" flow inside Letter Lab; the Agents
page gains an expandable run detail (per-employee item list with letter preview).

---

## Cross-cutting

### Config

```
GEMINI_API_KEY=            # Secret Manager in prod
GEMINI_MODEL=gemini-3.5-flash
GEMINI_CLASSIFIER_MODEL=gemini-2.5-flash-lite
GEMINI_EMBED_MODEL=gemini-embedding-2
AI_PROVIDER_CHAT=gemini
```

Added to `.env.example` with comments; `assertProductionConfig()` is **not**
extended (a missing Gemini key degrades gracefully — it is not an auth bypass).

### Security & tenancy

- All new tables carry `companyId` and flow through `TenantPrismaService`.
- Conversations are owner-private (explicit `userId` check, not just tenant).
- Employee persona: the data guardrail is the self-scoped snapshot (the model
  never receives other employees' records). Policy chunks are tenant-scoped but
  deliberately shared across personas — the handbook is company-public content.
  The output guard's cross-employee PII scan is defense in depth on top.
- Moderation log stores hashes, not raw abusive text.
- Rate limiting on all generation endpoints (shared limiter from Module B).

### Testing

- Unit (colocated `*.spec.ts`): guardrail stages with mocked classifier
  (red-team fixtures per category), chunker, cosine retrieval ranking, merge-field
  substitution, `GeminiProvider` request mapping (SDK mocked), refusal persistence.
- e2e (`test/agent.e2e-spec.ts`, key-free): conversation CRUD + ownership/tenant
  isolation, blocklist refusal path end-to-end, mass-issue → approval → vault
  filing, policy upload lifecycle with a stubbed provider.
- Opt-in live e2e (needs `GEMINI_API_KEY`): one happy-path chat turn, one
  red-team prompt per category actually refused.
- Frontend Playwright: `/assistant` send/receive (against key-free fallback),
  mass-letter flow through approval.

### Build order (cmux panes)

1. **Pane 1 — Module A** (blocking, small): interface + GeminiProvider + AiModule
   + env plumbing. Merges first.
2. **Panes 2/3/4 in parallel — B, C, E** against A's merged interface.
3. **Pane 5 — Module D** last: composes B + C, rewires quick-ask, frontend chat.
4. Each pane: own worktree/branch, plan-per-module, `npm test` + lint green
   before merge; integration e2e suite runs after D lands.
