# Module C — Policy Handbook RAG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins upload one policy handbook per tenant (PDF or pasted text); the backend extracts, chunks, and embeds it, and exposes a `PolicyRetrievalService.retrieve()` interface that Module D's chat agent uses to answer policy questions with citations.

**Architecture:** New code lives in the existing `platform` bounded context (`src/contexts/platform/`) following its DDD/CQRS layout: pure domain chunker + cosine helpers, a `PolicyRepository` over `TenantPrismaService`, an async fire-and-forget ingestion pipeline through Module A's `LlmProvider` (PDF → markdown via inline document, chunk → embed in batches → persist), and an in-app cosine retrieval service. Frontend gets a new admin page `app/admin/settings/policies` (the Settings page has no tabs — it is a card grid, so Policies is a sibling route linked from a new Settings card).

**Tech Stack:** NestJS 11 + @nestjs/cqrs, Prisma 7 (`TenantPrismaService` tenant scoping), class-validator DTOs, Jest + supertest; Next.js 15 App Router, Server Actions + `openapi-fetch` typed client, `components/ui.tsx` primitives.

## Global Constraints

- **Module A is a hard dependency (parallel plan, merges first).** This plan imports, verbatim: `import { LLM_PROVIDER_CHAT, type LlmProvider } from 'src/platform/ai/llm-provider';` and `import { AiModule } from 'src/platform/ai/ai.module';`. `LlmProvider` is `{ complete(req: LlmRequest): Promise<LlmResult>; embed(texts: string[]): Promise<number[][]>; isLive(): boolean }`, `LlmRequest` supports `document?: { base64: string; mimeType: string }` and `LlmResult` is `{ text: string; blocked?: { reason: string } }`. If Module A landed these under different file names, fix the import paths only — never redefine the interface.
- **Prisma models `PolicyDocument` and `PolicyChunk` already exist** exactly as written in the design spec (`docs/superpowers/specs/2026-07-15-hr-ai-agent-gemini-guardrails-design.md`, Module C). **This plan contains NO schema changes and NO migrations.** Before Task 1, verify: `grep -n "model PolicyDocument" prisma/schema.prisma` must match; if not, stop — Module A/schema work has not merged.
- `PolicyDocument.status` values are exactly `'Processing' | 'Ready' | 'Failed'`; `sourceType` exactly `'pdf' | 'text'` (plain String columns, stored verbatim, no enum mapper).
- Chunking: target **~1,500 chars** per chunk, **200-char overlap**, nearest markdown heading recorded per chunk.
- Embedding: batches of **32** texts per `embed()` call.
- Retrieval: **top-5** chunks above a **0.5** cosine floor.
- **No `GEMINI_API_KEY` ⇒ handbook ingestion is refused** (HTTP 503) with the exact message: `AI is not configured — handbook ingestion requires GEMINI_API_KEY. Set the key and try again.` (spec: "handbook ingestion is refused with a clear message"; chunks without embeddings would be dead weight). Nothing crashes.
- Ingestion runs **async after the upload request returns** (fire-and-forget promise with logged failure; failures set status `Failed` with a Retry path).
- One active handbook per tenant: uploading replaces (deletes) the prior document; chunks cascade via `onDelete: Cascade`.
- All endpoints live under `/platform`, `@Roles('HR_ADMIN')`, standard guard chain (InternalKeyGuard → ActorGuard → RolesGuard — already global, nothing to add).
- All Prisma access goes through `TenantPrismaService` (tenant extension scopes reads and stamps `companyId` on create/createMany).
- Frontend: browser never calls the backend directly — Server Actions only, following the `app/actions/letters.ts` unwrap pattern. **After the backend endpoints land, `npm run api:generate` MUST be run in the frontend repo with the backend up** (regenerates `lib/api/generated/openapi.d.ts`; it is committed).
- Backend repo root: `/Users/ajaypradeepm/Work/Projects/Hustle Projects/Localninja/ninja-hr/ninja-hr-backend`. Frontend repo root: `/Users/ajaypradeepm/Work/Projects/Hustle Projects/Localninja/ninja-hr/ninja-hr-frontend`. They are separate git repos — commit in the repo you changed. Paths contain spaces: always quote them in shell commands.

---

## File structure

Backend (`ninja-hr-backend`):

| File | Responsibility |
|---|---|
| `src/contexts/platform/domain/policy.types.ts` | Create — shared types: `PolicySourceType`, `PolicyDocumentStatus`, `PolicyDocumentSummary`, `PolicyExcerpt`, refusal message constant |
| `src/contexts/platform/domain/policy-chunker.ts` (+ `.spec.ts`) | Create — pure markdown-aware splitter, no framework deps |
| `src/contexts/platform/domain/cosine.ts` (+ `.spec.ts`) | Create — cosine similarity + top-K helper, pure |
| `src/contexts/platform/infrastructure/policy.repository.ts` | Create — all Prisma access for policy documents/chunks |
| `src/contexts/platform/infrastructure/policy-ingestion.service.ts` (+ `.spec.ts`) | Create — extract → chunk → persist texts → embed → status pipeline |
| `src/contexts/platform/infrastructure/policy-retrieval.service.ts` (+ `.spec.ts`) | Create — embed question, in-app cosine, top-5 ≥ 0.5 → `PolicyExcerpt[]` (Module D's entry point) |
| `src/contexts/platform/application/commands/upload-policy-document.command.ts` (+ `.spec.ts`) | Create — replace-and-ingest command handler |
| `src/contexts/platform/application/commands/delete-policy-document.command.ts` | Create — delete handler |
| `src/contexts/platform/application/commands/retry-policy-ingestion.command.ts` (+ `.spec.ts`) | Create — re-embed-stored-chunks handler |
| `src/contexts/platform/application/queries/get-policy-documents.query.ts` | Create — list query handler |
| `src/contexts/platform/interface/dto/platform.dto.ts` | Modify — add `UploadPolicyDocumentDto` |
| `src/contexts/platform/interface/platform.controller.ts` | Modify — 4 policy-document endpoints |
| `src/contexts/platform/platform.module.ts` | Modify — import `AiModule`, register providers, export `PolicyRetrievalService` |
| `test/platform-policies.e2e-spec.ts` | Create — key-free e2e: refusal, validation, HR gating, CRUD, tenant isolation |

Frontend (`ninja-hr-frontend`):

| File | Responsibility |
|---|---|
| `lib/api/generated/openapi.d.ts` | Regenerate via `npm run api:generate` |
| `app/actions/policies.ts` | Create — Server Actions (list/upload/delete/retry) with letters.ts unwrap pattern |
| `app/admin/settings/policies/page.tsx` | Create — server page, fetches document list |
| `app/admin/settings/policies/policies-view.tsx` | Create — client view: upload PDF (client-side base64) or paste text, status chips, Retry, replace/delete, Processing poll |
| `app/admin/settings/settings-view.tsx` | Modify — "Policy Handbook" card linking to the new page |

---

### Task 1: Policy domain types + markdown-aware chunker

**Files:**
- Create: `src/contexts/platform/domain/policy.types.ts`
- Create: `src/contexts/platform/domain/policy-chunker.ts`
- Test: `src/contexts/platform/domain/policy-chunker.spec.ts`

**Interfaces:**
- Consumes: nothing (pure domain, zero imports).
- Produces:
  - `PolicySourceType = 'pdf' | 'text'`, `PolicyDocumentStatus = 'Processing' | 'Ready' | 'Failed'`
  - `PolicyDocumentSummary { id: string; title: string; sourceType: PolicySourceType; status: PolicyDocumentStatus; uploadedAt: string; chunkCount: number }`
  - `PolicyExcerpt { title: string; heading: string | null; ordinal: number; text: string }` — **the exact type Module D consumes**
  - `AI_NOT_CONFIGURED_MESSAGE` (exact refusal string)
  - `PolicyChunkDraft { ordinal: number; heading: string | null; text: string }`
  - `chunkPolicyText(markdown: string, opts?: { targetChars?: number; overlapChars?: number }): PolicyChunkDraft[]` with `CHUNK_TARGET_CHARS = 1500`, `CHUNK_OVERLAP_CHARS = 200`

All commands in this task run from the backend repo root:
`cd "/Users/ajaypradeepm/Work/Projects/Hustle Projects/Localninja/ninja-hr/ninja-hr-backend"`

- [ ] **Step 1: Write the failing test**

Create `src/contexts/platform/domain/policy-chunker.spec.ts`:

```ts
import { chunkPolicyText } from './policy-chunker';

/** n repetitions of sentence s, space-joined (deterministic long paragraphs). */
const para = (s: string, n: number) => Array.from({ length: n }, () => s).join(' ');

describe('chunkPolicyText', () => {
  it('returns [] for an empty document', () => {
    expect(chunkPolicyText('')).toEqual([]);
    expect(chunkPolicyText('   \n\n  ')).toEqual([]);
  });

  it('returns a single chunk (with heading) for a small document', () => {
    const chunks = chunkPolicyText('# Leave\n\nEmployees get 15 vacation days.');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({
      ordinal: 0,
      heading: 'Leave',
      text: '# Leave\n\nEmployees get 15 vacation days.',
    });
  });

  it('assigns sequential ordinals starting at 0', () => {
    const doc = Array.from({ length: 10 }, (_, i) =>
      para(`Paragraph ${i} text.`, 30),
    ).join('\n\n');
    const chunks = chunkPolicyText(doc);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((c) => c.ordinal)).toEqual(chunks.map((_, i) => i));
  });

  it('tags each chunk with its nearest markdown heading', () => {
    const doc = [
      '# Vacation',
      para('Vacation policy sentence.', 60), // ~1.5k chars — forces chunk boundaries
      '# Sick Leave',
      para('Sick leave policy sentence.', 60),
    ].join('\n\n');
    const chunks = chunkPolicyText(doc);
    const vacationChunks = chunks.filter((c) => c.heading === 'Vacation');
    const sickChunks = chunks.filter((c) => c.heading === 'Sick Leave');
    expect(vacationChunks.length).toBeGreaterThan(0);
    expect(sickChunks.length).toBeGreaterThan(0);
    expect(
      sickChunks.some((c) => c.text.includes('Sick leave policy sentence.')),
    ).toBe(true);
  });

  it('starts each subsequent chunk with the 200-char tail of the previous one (overlap)', () => {
    const doc = Array.from({ length: 10 }, (_, i) =>
      para(`Paragraph ${i} text.`, 30),
    ).join('\n\n');
    const chunks = chunkPolicyText(doc);
    expect(chunks.length).toBeGreaterThan(1);
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].text.startsWith(chunks[i - 1].text.slice(-200))).toBe(true);
    }
  });

  it('hard-splits a single oversized paragraph (no blank lines) into bounded chunks', () => {
    const giant = 'x'.repeat(5000);
    const chunks = chunkPolicyText(giant);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      // target + overlap + joiner is the hard ceiling
      expect(c.text.length).toBeLessThanOrEqual(1500 + 200 + 2);
      expect(c.heading).toBeNull();
    }
  });

  it('honours custom targetChars/overlapChars options', () => {
    const doc = Array.from({ length: 6 }, (_, i) => para(`Sentence ${i}.`, 10)).join('\n\n');
    const chunks = chunkPolicyText(doc, { targetChars: 200, overlapChars: 40 });
    expect(chunks.length).toBeGreaterThan(1);
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].text.startsWith(chunks[i - 1].text.slice(-40))).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/contexts/platform/domain/policy-chunker.spec.ts`
Expected: FAIL — `Cannot find module './policy-chunker'`

- [ ] **Step 3: Write the implementation**

Create `src/contexts/platform/domain/policy.types.ts`:

```ts
// src/contexts/platform/domain/policy.types.ts
// Shared types for the policy-handbook RAG feature (Module C). Pure domain —
// no framework or Prisma imports.

export type PolicySourceType = 'pdf' | 'text';

export type PolicyDocumentStatus = 'Processing' | 'Ready' | 'Failed';

/** What the admin Policies page lists. */
export interface PolicyDocumentSummary {
  id: string;
  title: string;
  sourceType: PolicySourceType;
  status: PolicyDocumentStatus;
  /** ISO date-time of upload. */
  uploadedAt: string;
  chunkCount: number;
}

/**
 * One retrieved handbook excerpt. THE contract Module D (chat agent) consumes
 * from PolicyRetrievalService.retrieve() — do not rename fields.
 */
export interface PolicyExcerpt {
  /** Document title, e.g. "Employee Manual 2026" — for the [title § heading] citation tag. */
  title: string;
  /** Nearest markdown section heading, or null when the chunk precedes any heading. */
  heading: string | null;
  /** Position of the chunk in the document (0-based) — for "§14"-style citations. */
  ordinal: number;
  /** The excerpt text injected into the POLICY EXCERPTS prompt block. */
  text: string;
}

/**
 * Spec (Module A, fallback behavior): with no GEMINI_API_KEY, handbook
 * ingestion is refused with a clear message. Exact user-facing copy — the e2e
 * suite asserts on it.
 */
export const AI_NOT_CONFIGURED_MESSAGE =
  'AI is not configured — handbook ingestion requires GEMINI_API_KEY. Set the key and try again.';
```

Create `src/contexts/platform/domain/policy-chunker.ts`:

```ts
// src/contexts/platform/domain/policy-chunker.ts
// Markdown-aware handbook splitter (Module C, spec: split on headings then
// paragraphs, ~1,500 chars per chunk, 200-char overlap, nearest heading
// recorded per chunk). Pure function — fully unit-tested, no dependencies.

export interface PolicyChunkDraft {
  /** Position in the document, 0-based — becomes PolicyChunk.ordinal. */
  ordinal: number;
  /** Nearest preceding markdown heading (text only, no #), or null. */
  heading: string | null;
  text: string;
}

export const CHUNK_TARGET_CHARS = 1500;
export const CHUNK_OVERLAP_CHARS = 200;

const HEADING_RE = /^#{1,6}\s+(.+)$/;

interface Block {
  heading: string | null;
  text: string;
}

/**
 * Phase 1: split markdown into paragraph blocks (blank-line separated), each
 * tagged with the nearest preceding heading. Heading lines become their own
 * blocks (kept in the output text for context) and update the running heading.
 */
function toBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  let heading: string | null = null;
  for (const rawPara of markdown.split(/\n{2,}/)) {
    const para = rawPara.trim();
    if (!para) continue;
    let buf: string[] = [];
    const flush = () => {
      if (buf.length > 0) {
        blocks.push({ heading, text: buf.join('\n').trim() });
        buf = [];
      }
    };
    for (const line of para.split('\n')) {
      const m = HEADING_RE.exec(line.trim());
      if (m) {
        flush();
        heading = m[1].trim();
        blocks.push({ heading, text: line.trim() });
      } else {
        buf.push(line);
      }
    }
    flush();
  }
  return blocks;
}

/** Phase 2: hard-split any single block longer than the target (e.g. a giant
 *  paragraph with no blank lines), overlapping consecutive segments. */
function hardSplit(block: Block, target: number, overlap: number): Block[] {
  if (block.text.length <= target) return [block];
  const out: Block[] = [];
  let start = 0;
  while (start < block.text.length) {
    const end = Math.min(start + target, block.text.length);
    out.push({ heading: block.heading, text: block.text.slice(start, end) });
    if (end >= block.text.length) break;
    start = end - overlap;
  }
  return out;
}

/**
 * Phase 3: greedily pack blocks into ~target-sized chunks. When a chunk
 * closes, the next chunk is seeded with the previous chunk's last
 * `overlapChars` characters so no fact is stranded on a boundary. A chunk's
 * heading is the heading of the first block packed into it.
 */
export function chunkPolicyText(
  markdown: string,
  opts: { targetChars?: number; overlapChars?: number } = {},
): PolicyChunkDraft[] {
  const target = opts.targetChars ?? CHUNK_TARGET_CHARS;
  const overlap = opts.overlapChars ?? CHUNK_OVERLAP_CHARS;
  const blocks = toBlocks(markdown).flatMap((b) => hardSplit(b, target, overlap));

  const chunks: PolicyChunkDraft[] = [];
  let bufText = '';
  let bufHeading: string | null = null;
  const flush = () => {
    const text = bufText.trim();
    if (text) chunks.push({ ordinal: chunks.length, heading: bufHeading, text });
    bufText = '';
  };

  for (const block of blocks) {
    if (!bufText) {
      bufHeading = block.heading;
      bufText = block.text;
      continue;
    }
    if (bufText.length + 2 + block.text.length > target) {
      const tail = bufText.slice(-overlap);
      flush();
      bufHeading = block.heading;
      bufText = `${tail}\n\n${block.text}`;
    } else {
      bufText = `${bufText}\n\n${block.text}`;
    }
  }
  flush();
  return chunks;
}
```

Note on the hard-split ceiling asserted in the test: a flushed chunk is at most `target` chars of packed blocks, and a freshly seeded chunk is `overlap + 2 + <one block ≤ target>` — hence the `1500 + 200 + 2` bound for the single-giant-paragraph case.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/contexts/platform/domain/policy-chunker.spec.ts`
Expected: PASS — 7 passed

- [ ] **Step 5: Lint and commit**

```bash
npm run lint
git add src/contexts/platform/domain/policy.types.ts src/contexts/platform/domain/policy-chunker.ts src/contexts/platform/domain/policy-chunker.spec.ts
git commit -m "feat(platform): policy handbook domain types and markdown-aware chunker"
```

---

### Task 2: Cosine similarity + top-K helper

**Files:**
- Create: `src/contexts/platform/domain/cosine.ts`
- Test: `src/contexts/platform/domain/cosine.spec.ts`

**Interfaces:**
- Consumes: nothing (pure domain).
- Produces:
  - `cosineSimilarity(a: number[], b: number[]): number` — 0 for mismatched lengths, empty, or zero vectors.
  - `Scored<T> { item: T; score: number }`
  - `topKBySimilarity<T>(query: number[], items: T[], getVector: (item: T) => number[], k: number, floor: number): Scored<T>[]` — highest score first, drops scores `< floor`, at most `k` results.

Run from the backend repo root.

- [ ] **Step 1: Write the failing test**

Create `src/contexts/platform/domain/cosine.spec.ts`:

```ts
import { cosineSimilarity, topKBySimilarity } from './cosine';

describe('cosineSimilarity', () => {
  it('is 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 6);
  });

  it('is 1 for parallel vectors of different magnitude', () => {
    expect(cosineSimilarity([1, 0], [7, 0])).toBeCloseTo(1, 6);
  });

  it('is 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 6);
  });

  it('is -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 6);
  });

  it('is 0 for mismatched lengths, empty vectors, and zero vectors (defensive)', () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
  });
});

describe('topKBySimilarity', () => {
  interface Row {
    id: string;
    vec: number[];
  }
  const rows: Row[] = [
    { id: 'exact', vec: [1, 0] },
    { id: 'orthogonal', vec: [0, 1] },
    { id: 'close', vec: [0.8, 0.6] }, // cos = 0.8
    { id: 'mid', vec: [0.6, 0.8] }, // cos = 0.6
    { id: 'empty-embedding', vec: [] }, // cos = 0 → filtered by floor
  ];

  it('ranks by similarity descending and applies the floor', () => {
    const top = topKBySimilarity([1, 0], rows, (r) => r.vec, 5, 0.5);
    expect(top.map((s) => s.item.id)).toEqual(['exact', 'close', 'mid']);
    expect(top[0].score).toBeCloseTo(1, 6);
    expect(top[1].score).toBeCloseTo(0.8, 6);
  });

  it('caps the result count at k', () => {
    const top = topKBySimilarity([1, 0], rows, (r) => r.vec, 2, 0.5);
    expect(top.map((s) => s.item.id)).toEqual(['exact', 'close']);
  });

  it('returns [] when nothing clears the floor', () => {
    expect(topKBySimilarity([1, 0], [rows[1]], (r) => r.vec, 5, 0.5)).toEqual([]);
  });

  it('returns [] for an empty item list', () => {
    expect(topKBySimilarity([1, 0], [] as Row[], (r) => r.vec, 5, 0.5)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/contexts/platform/domain/cosine.spec.ts`
Expected: FAIL — `Cannot find module './cosine'`

- [ ] **Step 3: Write the implementation**

Create `src/contexts/platform/domain/cosine.ts`:

```ts
// src/contexts/platform/domain/cosine.ts
// In-app cosine similarity for policy-chunk retrieval (Module C). The corpus
// is one small handbook per tenant (hundreds of chunks max) — a linear scan is
// deliberate; pgvector was ruled out in the design spec.

/**
 * Cosine similarity in [-1, 1]. Defensive zeros: mismatched lengths, empty
 * vectors, and zero vectors score 0 (an un-embedded chunk must never rank).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface Scored<T> {
  item: T;
  score: number;
}

/**
 * The `k` most similar items to `query`, highest first, dropping anything
 * scoring below `floor`.
 */
export function topKBySimilarity<T>(
  query: number[],
  items: T[],
  getVector: (item: T) => number[],
  k: number,
  floor: number,
): Scored<T>[] {
  return items
    .map((item) => ({ item, score: cosineSimilarity(query, getVector(item)) }))
    .filter((s) => s.score >= floor)
    .sort((x, y) => y.score - x.score)
    .slice(0, k);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/contexts/platform/domain/cosine.spec.ts`
Expected: PASS — 9 passed

- [ ] **Step 5: Lint and commit**

```bash
npm run lint
git add src/contexts/platform/domain/cosine.ts src/contexts/platform/domain/cosine.spec.ts
git commit -m "feat(platform): cosine similarity and top-K retrieval helpers"
```

---

### Task 3: PolicyRepository + PolicyIngestionService

**Files:**
- Create: `src/contexts/platform/infrastructure/policy.repository.ts`
- Create: `src/contexts/platform/infrastructure/policy-ingestion.service.ts`
- Test: `src/contexts/platform/infrastructure/policy-ingestion.service.spec.ts`

**Interfaces:**
- Consumes:
  - Module A: `LLM_PROVIDER_CHAT`, `LlmProvider` from `src/platform/ai/llm-provider` (`complete(req)`, `embed(texts)`, `isLive()`).
  - Task 1: `chunkPolicyText(markdown): PolicyChunkDraft[]`, types from `policy.types.ts`.
  - `TenantPrismaService` from `src/platform/database/tenant-prisma.service` (tenant-scoped Prisma; `create`/`createMany` are stamped with `companyId` automatically).
- Produces (used by Tasks 4–5):
  - `PolicyRepository` methods (exact signatures):
    - `listDocuments(): Promise<PolicyDocumentSummary[]>`
    - `getDocument(id: string): Promise<{ id: string; status: PolicyDocumentStatus } | null>`
    - `createDocument(input: { title: string; sourceType: PolicySourceType }): Promise<{ id: string }>`
    - `deleteAllDocuments(): Promise<void>`
    - `deleteDocument(id: string): Promise<void>`
    - `setStatus(id: string, status: PolicyDocumentStatus): Promise<void>`
    - `replaceChunks(documentId: string, drafts: PolicyChunkDraft[]): Promise<void>`
    - `listChunkTexts(documentId: string): Promise<PolicyChunkTextRow[]>` where `PolicyChunkTextRow { id: string; ordinal: number; heading: string | null; text: string }`
    - `countChunks(documentId: string): Promise<number>`
    - `setChunkEmbedding(id: string, embedding: number[]): Promise<void>`
    - `listReadyChunks(): Promise<ReadyPolicyChunkRow[]>` where `ReadyPolicyChunkRow { ordinal: number; heading: string | null; text: string; embedding: number[]; documentTitle: string }`
  - `PolicyIngestionService` (constructor `(llm: LlmProvider [@Inject(LLM_PROVIDER_CHAT)], repo: PolicyRepository)`):
    - `ingest(documentId: string, source: PolicyIngestSource): Promise<void>` — never throws
    - `retryEmbedding(documentId: string): Promise<void>` — never throws
    - `PolicyIngestSource { sourceType: PolicySourceType; base64?: string; text?: string }`
    - exported constants `EMBED_BATCH_SIZE = 32`, `PDF_EXTRACTION_PROMPT`

**Key design decision (resolves the retry problem):** chunk **texts are persisted before embedding** (`embedding: []`), then embeddings are written per chunk. So a failure during embedding leaves the texts in the DB and `POST :id/retry` can re-run the embed pass without re-uploading the source (the raw PDF/text is NOT stored — the schema has no column for it). If ingestion failed *before* any chunks were stored (PDF extraction failed), retry cannot recover and returns a 400 telling the admin to re-upload (Task 5). A document only ever reaches status `Ready` after every embedding succeeded.

The repository is a thin Prisma pass-through — it is exercised by the e2e suite (Task 6); the unit tests here mock it and cover the ingestion pipeline's logic.

Run from the backend repo root.

- [ ] **Step 1: Write the repository (no unit test — e2e-covered)**

Create `src/contexts/platform/infrastructure/policy.repository.ts`:

```ts
// src/contexts/platform/infrastructure/policy.repository.ts
import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from 'src/platform/database/tenant-prisma.service';
import type {
  PolicyDocumentStatus,
  PolicyDocumentSummary,
  PolicySourceType,
} from '../domain/policy.types';
import type { PolicyChunkDraft } from '../domain/policy-chunker';

export interface PolicyChunkTextRow {
  id: string;
  ordinal: number;
  heading: string | null;
  text: string;
}

export interface ReadyPolicyChunkRow {
  ordinal: number;
  heading: string | null;
  text: string;
  embedding: number[];
  documentTitle: string;
}

@Injectable()
export class PolicyRepository {
  constructor(private readonly prisma: TenantPrismaService) {}

  async listDocuments(): Promise<PolicyDocumentSummary[]> {
    const rows = await this.prisma.policyDocument.findMany({
      orderBy: { uploadedAt: 'desc' },
      include: { _count: { select: { chunks: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      sourceType: r.sourceType as PolicySourceType,
      status: r.status as PolicyDocumentStatus,
      uploadedAt: r.uploadedAt.toISOString(),
      chunkCount: r._count.chunks,
    }));
  }

  async getDocument(id: string): Promise<{ id: string; status: PolicyDocumentStatus } | null> {
    const row = await this.prisma.policyDocument.findFirst({ where: { id } });
    return row ? { id: row.id, status: row.status as PolicyDocumentStatus } : null;
  }

  async createDocument(input: {
    title: string;
    sourceType: PolicySourceType;
  }): Promise<{ id: string }> {
    // The tenant extension stamps companyId on create.
    const row = await this.prisma.policyDocument.create({
      data: { title: input.title, sourceType: input.sourceType, status: 'Processing' },
    });
    return { id: row.id };
  }

  /** One active handbook per tenant (v1): an upload replaces everything.
   *  Chunks cascade via the schema's onDelete: Cascade. */
  async deleteAllDocuments(): Promise<void> {
    await this.prisma.policyDocument.deleteMany({});
  }

  async deleteDocument(id: string): Promise<void> {
    await this.prisma.policyDocument.delete({ where: { id } });
  }

  async setStatus(id: string, status: PolicyDocumentStatus): Promise<void> {
    await this.prisma.policyDocument.update({ where: { id }, data: { status } });
  }

  /** Replaces the document's chunks with fresh texts; embeddings start empty
   *  and are filled per-chunk by setChunkEmbedding (retry-friendly). */
  async replaceChunks(documentId: string, drafts: PolicyChunkDraft[]): Promise<void> {
    await this.prisma.policyChunk.deleteMany({ where: { documentId } });
    await this.prisma.policyChunk.createMany({
      data: drafts.map((d) => ({
        documentId,
        ordinal: d.ordinal,
        heading: d.heading,
        text: d.text,
        embedding: [],
      })),
    });
  }

  async listChunkTexts(documentId: string): Promise<PolicyChunkTextRow[]> {
    return this.prisma.policyChunk.findMany({
      where: { documentId },
      orderBy: { ordinal: 'asc' },
      select: { id: true, ordinal: true, heading: true, text: true },
    });
  }

  async countChunks(documentId: string): Promise<number> {
    return this.prisma.policyChunk.count({ where: { documentId } });
  }

  async setChunkEmbedding(id: string, embedding: number[]): Promise<void> {
    await this.prisma.policyChunk.update({ where: { id }, data: { embedding } });
  }

  /** Every chunk of the tenant's Ready handbook, with the document title for
   *  [title § heading] citations. Tenant scoping via chunk.companyId. */
  async listReadyChunks(): Promise<ReadyPolicyChunkRow[]> {
    const rows = await this.prisma.policyChunk.findMany({
      where: { document: { status: 'Ready' } },
      orderBy: { ordinal: 'asc' },
      select: {
        ordinal: true,
        heading: true,
        text: true,
        embedding: true,
        document: { select: { title: true } },
      },
    });
    return rows.map((r) => ({
      ordinal: r.ordinal,
      heading: r.heading,
      text: r.text,
      embedding: r.embedding,
      documentTitle: r.document.title,
    }));
  }
}
```

- [ ] **Step 2: Write the failing ingestion-service test**

Create `src/contexts/platform/infrastructure/policy-ingestion.service.spec.ts`:

```ts
import type { LlmProvider } from 'src/platform/ai/llm-provider';
import {
  EMBED_BATCH_SIZE,
  PDF_EXTRACTION_PROMPT,
  PolicyIngestionService,
} from './policy-ingestion.service';
import type { PolicyChunkTextRow, PolicyRepository } from './policy.repository';

function makeMocks(chunkRows: PolicyChunkTextRow[]) {
  const llm = {
    complete: jest.fn(),
    embed: jest.fn(async (texts: string[]) => texts.map(() => [0.1, 0.2])),
    isLive: jest.fn(() => true),
  };
  const repo = {
    replaceChunks: jest.fn(async () => undefined),
    listChunkTexts: jest.fn(async () => chunkRows),
    setChunkEmbedding: jest.fn(async () => undefined),
    setStatus: jest.fn(async () => undefined),
  };
  const svc = new PolicyIngestionService(
    llm as unknown as LlmProvider,
    repo as unknown as PolicyRepository,
  );
  return { llm, repo, svc };
}

const row = (i: number): PolicyChunkTextRow => ({
  id: `chunk-${i}`,
  ordinal: i,
  heading: null,
  text: `chunk text ${i}`,
});

describe('PolicyIngestionService.ingest', () => {
  it('text source: chunks, persists texts, embeds, and marks Ready', async () => {
    const { llm, repo, svc } = makeMocks([row(0)]);
    await svc.ingest('doc-1', {
      sourceType: 'text',
      text: '# Leave\n\nEmployees get 15 vacation days.',
    });

    expect(repo.replaceChunks).toHaveBeenCalledWith('doc-1', [
      {
        ordinal: 0,
        heading: 'Leave',
        text: '# Leave\n\nEmployees get 15 vacation days.',
      },
    ]);
    expect(llm.embed).toHaveBeenCalledWith(['chunk text 0']);
    expect(repo.setChunkEmbedding).toHaveBeenCalledWith('chunk-0', [0.1, 0.2]);
    expect(repo.setStatus).toHaveBeenLastCalledWith('doc-1', 'Ready');
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it('embeds in batches of 32', async () => {
    const rows = Array.from({ length: 70 }, (_, i) => row(i));
    const { llm, repo, svc } = makeMocks(rows);
    await svc.ingest('doc-1', { sourceType: 'text', text: 'body' });

    expect(EMBED_BATCH_SIZE).toBe(32);
    expect(llm.embed).toHaveBeenCalledTimes(3); // 32 + 32 + 6
    expect((llm.embed.mock.calls[0][0] as string[]).length).toBe(32);
    expect((llm.embed.mock.calls[2][0] as string[]).length).toBe(6);
    expect(repo.setChunkEmbedding).toHaveBeenCalledTimes(70);
    expect(repo.setStatus).toHaveBeenLastCalledWith('doc-1', 'Ready');
  });

  it('pdf source: extracts markdown via complete() with the inline document', async () => {
    const { llm, repo, svc } = makeMocks([row(0)]);
    llm.complete.mockResolvedValue({ text: '# Title\n\nExtracted body.' });
    await svc.ingest('doc-1', { sourceType: 'pdf', base64: 'JVBERi0=' });

    expect(llm.complete).toHaveBeenCalledTimes(1);
    const req = llm.complete.mock.calls[0][0] as {
      messages: { role: string; content: string }[];
      document?: { base64: string; mimeType: string };
    };
    expect(req.document).toEqual({ base64: 'JVBERi0=', mimeType: 'application/pdf' });
    expect(req.messages[0].content).toBe(PDF_EXTRACTION_PROMPT);
    expect(repo.setStatus).toHaveBeenLastCalledWith('doc-1', 'Ready');
  });

  it('marks Failed (and does not throw) when the provider blocks extraction', async () => {
    const { llm, repo, svc } = makeMocks([]);
    llm.complete.mockResolvedValue({ text: '', blocked: { reason: 'SAFETY' } });
    await svc.ingest('doc-1', { sourceType: 'pdf', base64: 'JVBERi0=' });

    expect(repo.replaceChunks).not.toHaveBeenCalled();
    expect(repo.setStatus).toHaveBeenLastCalledWith('doc-1', 'Failed');
  });

  it('marks Failed when the text is empty (nothing to chunk)', async () => {
    const { llm, repo, svc } = makeMocks([]);
    await svc.ingest('doc-1', { sourceType: 'text', text: '   ' });

    expect(llm.embed).not.toHaveBeenCalled();
    expect(repo.setStatus).toHaveBeenLastCalledWith('doc-1', 'Failed');
  });

  it('marks Failed when embedding throws — but chunk texts stay persisted for retry', async () => {
    const { llm, repo, svc } = makeMocks([row(0)]);
    llm.embed.mockRejectedValue(new Error('embed quota exceeded'));
    await svc.ingest('doc-1', { sourceType: 'text', text: 'body text' });

    expect(repo.replaceChunks).toHaveBeenCalledTimes(1); // texts stored before embed
    expect(repo.setStatus).toHaveBeenLastCalledWith('doc-1', 'Failed');
  });

  it('marks Failed when embed returns the wrong number of vectors', async () => {
    const { llm, repo, svc } = makeMocks([row(0), row(1)]);
    llm.embed.mockResolvedValue([[0.1, 0.2]]); // 1 vector for 2 texts
    await svc.ingest('doc-1', { sourceType: 'text', text: 'body text' });

    expect(repo.setStatus).toHaveBeenLastCalledWith('doc-1', 'Failed');
  });
});

describe('PolicyIngestionService.retryEmbedding', () => {
  it('re-embeds the stored chunk texts and marks Ready', async () => {
    const { llm, repo, svc } = makeMocks([row(0), row(1)]);
    await svc.retryEmbedding('doc-1');

    expect(repo.replaceChunks).not.toHaveBeenCalled(); // texts are reused, not rebuilt
    expect(llm.embed).toHaveBeenCalledWith(['chunk text 0', 'chunk text 1']);
    expect(repo.setChunkEmbedding).toHaveBeenCalledTimes(2);
    expect(repo.setStatus).toHaveBeenLastCalledWith('doc-1', 'Ready');
  });

  it('marks Failed (and does not throw) when re-embedding fails', async () => {
    const { llm, repo, svc } = makeMocks([row(0)]);
    llm.embed.mockRejectedValue(new Error('still down'));
    await svc.retryEmbedding('doc-1');

    expect(repo.setStatus).toHaveBeenLastCalledWith('doc-1', 'Failed');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/contexts/platform/infrastructure/policy-ingestion.service.spec.ts`
Expected: FAIL — `Cannot find module './policy-ingestion.service'`

- [ ] **Step 4: Write the ingestion service**

Create `src/contexts/platform/infrastructure/policy-ingestion.service.ts`:

```ts
// src/contexts/platform/infrastructure/policy-ingestion.service.ts
// Handbook ingestion pipeline (Module C): (pdf → markdown via the model, same
// "model is the parser" pattern as resume-parser.service.ts) → chunk →
// persist chunk texts → embed in batches → status Ready. Runs fire-and-forget
// after the upload request returns, so its public methods NEVER throw — any
// failure logs and sets the document to Failed (retryable).
import { Inject, Injectable, Logger } from '@nestjs/common';
import { LLM_PROVIDER_CHAT, type LlmProvider } from 'src/platform/ai/llm-provider';
import { chunkPolicyText } from '../domain/policy-chunker';
import type { PolicySourceType } from '../domain/policy.types';
import { PolicyRepository } from './policy.repository';

/** Extraction prompt sent alongside the inline PDF (LlmRequest.document). */
export const PDF_EXTRACTION_PROMPT = `Extract the complete text of this employee policy handbook PDF.
Return clean markdown and nothing else — no preamble, no code fences, no commentary.
Rules:
- Preserve the document's section structure: render every section title as a markdown heading (#, ##, ### matching its nesting level in the document).
- Preserve paragraph breaks, bullet lists, and numbered lists.
- Render tables as markdown tables.
- Skip page headers, page footers, page numbers, and watermarks.
- Do not summarize, reorder, or omit any policy content.`;

/** Handbooks are long-form — give the extraction call generous output room. */
const PDF_EXTRACTION_MAX_TOKENS = 32768;

/** Module C spec: embed in batches of 32. */
export const EMBED_BATCH_SIZE = 32;

export interface PolicyIngestSource {
  sourceType: PolicySourceType;
  base64?: string;
  text?: string;
}

@Injectable()
export class PolicyIngestionService {
  private readonly logger = new Logger(PolicyIngestionService.name);

  constructor(
    @Inject(LLM_PROVIDER_CHAT) private readonly llm: LlmProvider,
    private readonly repo: PolicyRepository,
  ) {}

  /** Full pipeline for a freshly uploaded document. Never throws. */
  async ingest(documentId: string, source: PolicyIngestSource): Promise<void> {
    try {
      const markdown =
        source.sourceType === 'pdf'
          ? await this.extractPdfText(source.base64 ?? '')
          : (source.text ?? '');
      const drafts = chunkPolicyText(markdown);
      if (drafts.length === 0) {
        throw new Error('no text could be extracted from the document');
      }
      // Persist texts first (embedding: []) so a failed embed pass can be
      // retried from stored chunks without re-uploading the source.
      await this.repo.replaceChunks(documentId, drafts);
      await this.embedStoredChunks(documentId);
      await this.repo.setStatus(documentId, 'Ready');
    } catch (err) {
      this.logger.error(
        `policy ingestion failed for ${documentId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      await this.repo.setStatus(documentId, 'Failed').catch(() => undefined);
    }
  }

  /** Retry path (POST /platform/policy-documents/:id/retry): re-embeds the
   *  chunk texts already stored for this document. Never throws. */
  async retryEmbedding(documentId: string): Promise<void> {
    try {
      await this.embedStoredChunks(documentId);
      await this.repo.setStatus(documentId, 'Ready');
    } catch (err) {
      this.logger.error(
        `policy re-embedding failed for ${documentId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      await this.repo.setStatus(documentId, 'Failed').catch(() => undefined);
    }
  }

  /** Embeds every stored chunk in batches of EMBED_BATCH_SIZE; throws on failure. */
  private async embedStoredChunks(documentId: string): Promise<void> {
    const chunks = await this.repo.listChunkTexts(documentId);
    for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
      const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
      const vectors = await this.llm.embed(batch.map((c) => c.text));
      if (vectors.length !== batch.length) {
        throw new Error(`embed returned ${vectors.length} vectors for ${batch.length} texts`);
      }
      for (let j = 0; j < batch.length; j++) {
        await this.repo.setChunkEmbedding(batch[j].id, vectors[j]);
      }
    }
  }

  private async extractPdfText(base64: string): Promise<string> {
    const result = await this.llm.complete({
      system: 'You are a precise document-to-markdown extraction engine.',
      messages: [{ role: 'user', content: PDF_EXTRACTION_PROMPT }],
      maxTokens: PDF_EXTRACTION_MAX_TOKENS,
      document: { base64, mimeType: 'application/pdf' },
    });
    if (result.blocked) {
      throw new Error(`provider blocked PDF extraction: ${result.blocked.reason}`);
    }
    return result.text;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/contexts/platform/infrastructure/policy-ingestion.service.spec.ts`
Expected: PASS — 9 passed

- [ ] **Step 6: Lint and commit**

```bash
npm run lint
git add src/contexts/platform/infrastructure/policy.repository.ts src/contexts/platform/infrastructure/policy-ingestion.service.ts src/contexts/platform/infrastructure/policy-ingestion.service.spec.ts
git commit -m "feat(platform): policy repository and async handbook ingestion pipeline"
```

---

### Task 4: PolicyRetrievalService (Module D's entry point)

**Files:**
- Create: `src/contexts/platform/infrastructure/policy-retrieval.service.ts`
- Test: `src/contexts/platform/infrastructure/policy-retrieval.service.spec.ts`

**Interfaces:**
- Consumes: `LLM_PROVIDER_CHAT`/`LlmProvider` (Module A), `topKBySimilarity` (Task 2), `PolicyExcerpt` (Task 1), `PolicyRepository.listReadyChunks()` (Task 3).
- Produces — **the exact contract Module D consumes**:
  - `PolicyRetrievalService.retrieve(question: string): Promise<PolicyExcerpt[]>` (constructor `(llm [@Inject(LLM_PROVIDER_CHAT)], repo: PolicyRepository)`), exported from `PlatformModule` in Task 5.
  - Returns `[]` (never throws, never null) when: provider not live, no Ready handbook, nothing above the floor, or any error.
  - Constants `RETRIEVAL_TOP_K = 5`, `RETRIEVAL_SCORE_FLOOR = 0.5`.

Run from the backend repo root.

- [ ] **Step 1: Write the failing test**

Create `src/contexts/platform/infrastructure/policy-retrieval.service.spec.ts`:

```ts
import type { LlmProvider } from 'src/platform/ai/llm-provider';
import {
  PolicyRetrievalService,
  RETRIEVAL_SCORE_FLOOR,
  RETRIEVAL_TOP_K,
} from './policy-retrieval.service';
import type { PolicyRepository, ReadyPolicyChunkRow } from './policy.repository';

const chunk = (
  ordinal: number,
  heading: string | null,
  text: string,
  embedding: number[],
): ReadyPolicyChunkRow => ({
  ordinal,
  heading,
  text,
  embedding,
  documentTitle: 'Employee Manual 2026',
});

function makeService(rows: ReadyPolicyChunkRow[], opts: { live?: boolean } = {}) {
  const llm = {
    complete: jest.fn(),
    embed: jest.fn(async () => [[1, 0]]), // the question's vector
    isLive: jest.fn(() => opts.live ?? true),
  };
  const repo = { listReadyChunks: jest.fn(async () => rows) };
  const svc = new PolicyRetrievalService(
    llm as unknown as LlmProvider,
    repo as unknown as PolicyRepository,
  );
  return { llm, repo, svc };
}

describe('PolicyRetrievalService.retrieve', () => {
  it('exposes the spec constants', () => {
    expect(RETRIEVAL_TOP_K).toBe(5);
    expect(RETRIEVAL_SCORE_FLOOR).toBe(0.5);
  });

  it('returns the best chunks above the floor, mapped to PolicyExcerpt', async () => {
    const rows = [
      chunk(0, 'Vacation', 'Vacation is 15 days.', [1, 0]), // cos 1.0
      chunk(1, 'Sick Leave', 'Sick leave is 5 days.', [0.8, 0.6]), // cos 0.8
      chunk(2, null, 'Preamble.', [0, 1]), // cos 0 → floored out
      chunk(3, 'Parking', 'Parking is unassigned.', [0.6, 0.8]), // cos 0.6
    ];
    const { llm, svc } = makeService(rows);
    const excerpts = await svc.retrieve('how many vacation days do I get?');

    expect(llm.embed).toHaveBeenCalledTimes(1); // exactly one embed call
    expect(llm.embed).toHaveBeenCalledWith(['how many vacation days do I get?']);
    expect(excerpts).toEqual([
      { title: 'Employee Manual 2026', heading: 'Vacation', ordinal: 0, text: 'Vacation is 15 days.' },
      { title: 'Employee Manual 2026', heading: 'Sick Leave', ordinal: 1, text: 'Sick leave is 5 days.' },
      { title: 'Employee Manual 2026', heading: 'Parking', ordinal: 3, text: 'Parking is unassigned.' },
    ]);
  });

  it('caps results at top-5', async () => {
    const rows = Array.from({ length: 8 }, (_, i) => chunk(i, 'H', `t${i}`, [1, 0]));
    const { svc } = makeService(rows);
    expect(await svc.retrieve('q')).toHaveLength(5);
  });

  it('ignores chunks with empty embeddings (score 0 < floor)', async () => {
    const { svc } = makeService([chunk(0, 'H', 'unembedded', [])]);
    expect(await svc.retrieve('q')).toEqual([]);
  });

  it('returns [] without any calls when the provider is not live', async () => {
    const { llm, repo, svc } = makeService([chunk(0, 'H', 't', [1, 0])], { live: false });
    expect(await svc.retrieve('q')).toEqual([]);
    expect(repo.listReadyChunks).not.toHaveBeenCalled();
    expect(llm.embed).not.toHaveBeenCalled();
  });

  it('returns [] without embedding when the tenant has no Ready handbook', async () => {
    const { llm, svc } = makeService([]);
    expect(await svc.retrieve('q')).toEqual([]);
    expect(llm.embed).not.toHaveBeenCalled();
  });

  it('returns [] (never throws) when embedding fails', async () => {
    const { llm, svc } = makeService([chunk(0, 'H', 't', [1, 0])]);
    llm.embed.mockRejectedValue(new Error('quota'));
    await expect(svc.retrieve('q')).resolves.toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/contexts/platform/infrastructure/policy-retrieval.service.spec.ts`
Expected: FAIL — `Cannot find module './policy-retrieval.service'`

- [ ] **Step 3: Write the implementation**

Create `src/contexts/platform/infrastructure/policy-retrieval.service.ts`:

```ts
// src/contexts/platform/infrastructure/policy-retrieval.service.ts
// RAG retrieval (Module C → consumed by Module D's chat agent): embed the
// question (one call), load the tenant's Ready handbook chunks, in-app cosine
// ranking, top-5 above the 0.5 floor. Degrades to [] on every failure — the
// agent must keep answering (without excerpts) when retrieval is down.
import { Inject, Injectable, Logger } from '@nestjs/common';
import { LLM_PROVIDER_CHAT, type LlmProvider } from 'src/platform/ai/llm-provider';
import { topKBySimilarity } from '../domain/cosine';
import type { PolicyExcerpt } from '../domain/policy.types';
import { PolicyRepository } from './policy.repository';

export const RETRIEVAL_TOP_K = 5;
export const RETRIEVAL_SCORE_FLOOR = 0.5;

@Injectable()
export class PolicyRetrievalService {
  private readonly logger = new Logger(PolicyRetrievalService.name);

  constructor(
    @Inject(LLM_PROVIDER_CHAT) private readonly llm: LlmProvider,
    private readonly repo: PolicyRepository,
  ) {}

  /**
   * The interface Module D consumes. Returns [] when the provider is not
   * live, the tenant has no Ready handbook, nothing clears the similarity
   * floor, or anything errors — callers need no special error handling.
   */
  async retrieve(question: string): Promise<PolicyExcerpt[]> {
    if (!this.llm.isLive()) return [];
    try {
      const chunks = await this.repo.listReadyChunks();
      if (chunks.length === 0) return [];
      const [queryVector] = await this.llm.embed([question]);
      return topKBySimilarity(
        queryVector,
        chunks,
        (c) => c.embedding,
        RETRIEVAL_TOP_K,
        RETRIEVAL_SCORE_FLOOR,
      ).map(({ item }) => ({
        title: item.documentTitle,
        heading: item.heading,
        ordinal: item.ordinal,
        text: item.text,
      }));
    } catch (err) {
      this.logger.error(
        `policy retrieval failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/contexts/platform/infrastructure/policy-retrieval.service.spec.ts`
Expected: PASS — 7 passed

- [ ] **Step 5: Lint and commit**

```bash
npm run lint
git add src/contexts/platform/infrastructure/policy-retrieval.service.ts src/contexts/platform/infrastructure/policy-retrieval.service.spec.ts
git commit -m "feat(platform): policy retrieval service (top-5 cosine, 0.5 floor) for the chat agent"
```

---

### Task 5: CQRS handlers, DTO, controller endpoints, module wiring

**Files:**
- Create: `src/contexts/platform/application/commands/upload-policy-document.command.ts`
- Create: `src/contexts/platform/application/commands/delete-policy-document.command.ts`
- Create: `src/contexts/platform/application/commands/retry-policy-ingestion.command.ts`
- Create: `src/contexts/platform/application/queries/get-policy-documents.query.ts`
- Modify: `src/contexts/platform/interface/dto/platform.dto.ts` (append)
- Modify: `src/contexts/platform/interface/platform.controller.ts` (append endpoints)
- Modify: `src/contexts/platform/platform.module.ts` (imports/providers/exports)
- Test: `src/contexts/platform/application/commands/upload-policy-document.command.spec.ts`
- Test: `src/contexts/platform/application/commands/retry-policy-ingestion.command.spec.ts`

**Interfaces:**
- Consumes: `PolicyRepository`, `PolicyIngestionService` (Task 3), `AI_NOT_CONFIGURED_MESSAGE` + types (Task 1), `LLM_PROVIDER_CHAT`/`LlmProvider` + `AiModule` (Module A), `TenantContext` from `src/platform/database/tenant-context` (`companyId` getter, `run(companyId, fn)`).
- Produces:
  - HTTP: `GET/POST /api/v1/platform/policy-documents`, `DELETE /api/v1/platform/policy-documents/:id`, `POST /api/v1/platform/policy-documents/:id/retry` — all `@Roles('HR_ADMIN')`; every mutation returns the refreshed `PolicyDocumentSummary[]` (this codebase's convention).
  - `PlatformModule` exports `PolicyRetrievalService` (Module D imports `PlatformModule` and injects it).
  - Error contract: 400 malformed body (shape checks come **before** the key gate so validation errors are stable regardless of config), 503 with `AI_NOT_CONFIGURED_MESSAGE` when `isLive()` is false, 404 unknown/cross-tenant id, 400 retry on non-`Failed` document, 400 retry when no chunk texts were stored (source not recoverable — re-upload).

Run from the backend repo root.

- [ ] **Step 1: Write the failing handler tests**

Create `src/contexts/platform/application/commands/upload-policy-document.command.spec.ts`:

```ts
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import {
  UploadPolicyDocumentCommand,
  UploadPolicyDocumentHandler,
} from './upload-policy-document.command';

function makeHandler(opts: { live?: boolean } = {}) {
  const repo = {
    deleteAllDocuments: jest.fn(async () => undefined),
    createDocument: jest.fn(async () => ({ id: 'doc-1' })),
    listDocuments: jest.fn(async () => [
      {
        id: 'doc-1',
        title: 'Employee Manual 2026',
        sourceType: 'text' as const,
        status: 'Processing' as const,
        uploadedAt: '2026-07-15T00:00:00.000Z',
        chunkCount: 0,
      },
    ]),
  };
  const ingestion = { ingest: jest.fn(async () => undefined) };
  const tenant = {
    companyId: 'company-1',
    run: jest.fn((_: string | null, fn: () => unknown) => fn()),
  };
  const llm = {
    complete: jest.fn(),
    embed: jest.fn(),
    isLive: jest.fn(() => opts.live ?? true),
  };
  const handler = new UploadPolicyDocumentHandler(
    repo as never,
    ingestion as never,
    tenant as never,
    llm as never,
  );
  return { repo, ingestion, tenant, llm, handler };
}

describe('UploadPolicyDocumentHandler', () => {
  it('rejects a text upload without text (400)', async () => {
    const { handler } = makeHandler();
    await expect(
      handler.execute(
        new UploadPolicyDocumentCommand({ title: 'Manual', sourceType: 'text' }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a pdf upload without base64 (400)', async () => {
    const { handler } = makeHandler();
    await expect(
      handler.execute(
        new UploadPolicyDocumentCommand({ title: 'Manual', sourceType: 'pdf' }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses ingestion when the provider is not live (503), touching nothing', async () => {
    const { handler, repo } = makeHandler({ live: false });
    await expect(
      handler.execute(
        new UploadPolicyDocumentCommand({ title: 'Manual', sourceType: 'text', text: 'body' }),
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(repo.deleteAllDocuments).not.toHaveBeenCalled();
    expect(repo.createDocument).not.toHaveBeenCalled();
  });

  it('replaces the prior handbook, creates Processing doc, and fires ingestion in tenant scope', async () => {
    const { handler, repo, ingestion, tenant } = makeHandler();
    const input = { title: 'Employee Manual 2026', sourceType: 'text' as const, text: '# Leave\n\nBody.' };
    const result = await handler.execute(new UploadPolicyDocumentCommand(input));

    expect(repo.deleteAllDocuments).toHaveBeenCalledTimes(1);
    expect(repo.createDocument).toHaveBeenCalledWith({
      title: 'Employee Manual 2026',
      sourceType: 'text',
    });
    expect(tenant.run).toHaveBeenCalledWith('company-1', expect.any(Function));
    expect(ingestion.ingest).toHaveBeenCalledWith('doc-1', input);
    expect(result[0].status).toBe('Processing');
  });
});
```

Create `src/contexts/platform/application/commands/retry-policy-ingestion.command.spec.ts`:

```ts
import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  RetryPolicyIngestionCommand,
  RetryPolicyIngestionHandler,
} from './retry-policy-ingestion.command';

function makeHandler(opts: {
  doc?: { id: string; status: 'Processing' | 'Ready' | 'Failed' } | null;
  chunkCount?: number;
  live?: boolean;
}) {
  const repo = {
    getDocument: jest.fn(async () => opts.doc ?? null),
    countChunks: jest.fn(async () => opts.chunkCount ?? 0),
    setStatus: jest.fn(async () => undefined),
    listDocuments: jest.fn(async () => []),
  };
  const ingestion = { retryEmbedding: jest.fn(async () => undefined) };
  const tenant = {
    companyId: 'company-1',
    run: jest.fn((_: string | null, fn: () => unknown) => fn()),
  };
  const llm = { complete: jest.fn(), embed: jest.fn(), isLive: jest.fn(() => opts.live ?? true) };
  const handler = new RetryPolicyIngestionHandler(
    repo as never,
    ingestion as never,
    tenant as never,
    llm as never,
  );
  return { repo, ingestion, tenant, handler };
}

describe('RetryPolicyIngestionHandler', () => {
  it('404s for an unknown document', async () => {
    const { handler } = makeHandler({ doc: null });
    await expect(handler.execute(new RetryPolicyIngestionCommand('nope'))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('400s when the document is not Failed', async () => {
    const { handler } = makeHandler({ doc: { id: 'doc-1', status: 'Ready' } });
    await expect(handler.execute(new RetryPolicyIngestionCommand('doc-1'))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('400s when no chunk texts were stored (source not recoverable)', async () => {
    const { handler } = makeHandler({ doc: { id: 'doc-1', status: 'Failed' }, chunkCount: 0 });
    await expect(handler.execute(new RetryPolicyIngestionCommand('doc-1'))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('503s when the provider is not live', async () => {
    const { handler } = makeHandler({
      doc: { id: 'doc-1', status: 'Failed' },
      chunkCount: 3,
      live: false,
    });
    await expect(handler.execute(new RetryPolicyIngestionCommand('doc-1'))).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('sets Processing and fires the re-embed in tenant scope', async () => {
    const { handler, repo, ingestion, tenant } = makeHandler({
      doc: { id: 'doc-1', status: 'Failed' },
      chunkCount: 3,
    });
    await handler.execute(new RetryPolicyIngestionCommand('doc-1'));

    expect(repo.setStatus).toHaveBeenCalledWith('doc-1', 'Processing');
    expect(tenant.run).toHaveBeenCalledWith('company-1', expect.any(Function));
    expect(ingestion.retryEmbedding).toHaveBeenCalledWith('doc-1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/contexts/platform/application/commands/upload-policy-document.command.spec.ts src/contexts/platform/application/commands/retry-policy-ingestion.command.spec.ts`
Expected: FAIL — `Cannot find module './upload-policy-document.command'` (and the retry module)

- [ ] **Step 3: Write the command/query handlers**

Create `src/contexts/platform/application/commands/upload-policy-document.command.ts`:

```ts
// src/contexts/platform/application/commands/upload-policy-document.command.ts
import {
  BadRequestException,
  Inject,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { LLM_PROVIDER_CHAT, type LlmProvider } from 'src/platform/ai/llm-provider';
import { TenantContext } from 'src/platform/database/tenant-context';
import {
  AI_NOT_CONFIGURED_MESSAGE,
  type PolicyDocumentSummary,
  type PolicySourceType,
} from '../../domain/policy.types';
import { PolicyIngestionService } from '../../infrastructure/policy-ingestion.service';
import { PolicyRepository } from '../../infrastructure/policy.repository';

export interface UploadPolicyDocumentInput {
  title: string;
  sourceType: PolicySourceType;
  base64?: string;
  text?: string;
}

export class UploadPolicyDocumentCommand {
  constructor(public readonly input: UploadPolicyDocumentInput) {}
}

@CommandHandler(UploadPolicyDocumentCommand)
export class UploadPolicyDocumentHandler
  implements ICommandHandler<UploadPolicyDocumentCommand, PolicyDocumentSummary[]>
{
  private readonly logger = new Logger(UploadPolicyDocumentHandler.name);

  constructor(
    private readonly repo: PolicyRepository,
    private readonly ingestion: PolicyIngestionService,
    private readonly tenant: TenantContext,
    @Inject(LLM_PROVIDER_CHAT) private readonly llm: LlmProvider,
  ) {}

  async execute({ input }: UploadPolicyDocumentCommand): Promise<PolicyDocumentSummary[]> {
    // Shape errors first — a 400 must be stable regardless of key config…
    if (input.sourceType === 'pdf' && !input.base64) {
      throw new BadRequestException('base64 is required when sourceType is "pdf"');
    }
    if (input.sourceType === 'text' && !input.text?.trim()) {
      throw new BadRequestException('text is required when sourceType is "text"');
    }
    // …then the key gate: chunks without embeddings would be dead weight, so
    // ingestion is refused outright when the provider is not live (spec).
    if (!this.llm.isLive()) {
      throw new ServiceUnavailableException(AI_NOT_CONFIGURED_MESSAGE);
    }

    // One active handbook per tenant (v1): replacing deletes the prior document.
    await this.repo.deleteAllDocuments();
    const { id } = await this.repo.createDocument({
      title: input.title,
      sourceType: input.sourceType,
    });

    // Fire-and-forget: the request returns "Processing" immediately and
    // ingestion finishes in the background (spec). Re-open the tenant ALS
    // store explicitly so the background work stays tenant-scoped after the
    // request's own store is gone. ingest() never throws; the catch is a
    // belt-and-braces operator signal.
    const companyId = this.tenant.companyId;
    void this.tenant
      .run(companyId, () => this.ingestion.ingest(id, input))
      .catch((err) =>
        this.logger.error(
          `policy ingestion crashed for ${id}: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );

    return this.repo.listDocuments();
  }
}
```

Create `src/contexts/platform/application/commands/delete-policy-document.command.ts`:

```ts
// src/contexts/platform/application/commands/delete-policy-document.command.ts
import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { PolicyDocumentSummary } from '../../domain/policy.types';
import { PolicyRepository } from '../../infrastructure/policy.repository';

export class DeletePolicyDocumentCommand {
  constructor(public readonly id: string) {}
}

@CommandHandler(DeletePolicyDocumentCommand)
export class DeletePolicyDocumentHandler
  implements ICommandHandler<DeletePolicyDocumentCommand, PolicyDocumentSummary[]>
{
  constructor(private readonly repo: PolicyRepository) {}

  async execute({ id }: DeletePolicyDocumentCommand): Promise<PolicyDocumentSummary[]> {
    // Tenant-scoped lookup: a cross-tenant id resolves to null → 404, never a
    // leak. Chunks cascade on delete.
    const doc = await this.repo.getDocument(id);
    if (!doc) throw new NotFoundException('Policy document not found');
    await this.repo.deleteDocument(id);
    return this.repo.listDocuments();
  }
}
```

Create `src/contexts/platform/application/commands/retry-policy-ingestion.command.ts`:

```ts
// src/contexts/platform/application/commands/retry-policy-ingestion.command.ts
import {
  BadRequestException,
  Inject,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { LLM_PROVIDER_CHAT, type LlmProvider } from 'src/platform/ai/llm-provider';
import { TenantContext } from 'src/platform/database/tenant-context';
import {
  AI_NOT_CONFIGURED_MESSAGE,
  type PolicyDocumentSummary,
} from '../../domain/policy.types';
import { PolicyIngestionService } from '../../infrastructure/policy-ingestion.service';
import { PolicyRepository } from '../../infrastructure/policy.repository';

export class RetryPolicyIngestionCommand {
  constructor(public readonly id: string) {}
}

@CommandHandler(RetryPolicyIngestionCommand)
export class RetryPolicyIngestionHandler
  implements ICommandHandler<RetryPolicyIngestionCommand, PolicyDocumentSummary[]>
{
  private readonly logger = new Logger(RetryPolicyIngestionHandler.name);

  constructor(
    private readonly repo: PolicyRepository,
    private readonly ingestion: PolicyIngestionService,
    private readonly tenant: TenantContext,
    @Inject(LLM_PROVIDER_CHAT) private readonly llm: LlmProvider,
  ) {}

  async execute({ id }: RetryPolicyIngestionCommand): Promise<PolicyDocumentSummary[]> {
    const doc = await this.repo.getDocument(id);
    if (!doc) throw new NotFoundException('Policy document not found');
    if (doc.status !== 'Failed') {
      throw new BadRequestException('Only a Failed document can be retried.');
    }
    // Retry re-embeds the chunk texts stored during the failed run. If nothing
    // was stored (extraction itself failed), the raw source is gone — the
    // admin must re-upload.
    const chunkCount = await this.repo.countChunks(id);
    if (chunkCount === 0) {
      throw new BadRequestException('The original file is not stored — upload the handbook again.');
    }
    if (!this.llm.isLive()) {
      throw new ServiceUnavailableException(AI_NOT_CONFIGURED_MESSAGE);
    }

    await this.repo.setStatus(id, 'Processing');
    const companyId = this.tenant.companyId;
    void this.tenant
      .run(companyId, () => this.ingestion.retryEmbedding(id))
      .catch((err) =>
        this.logger.error(
          `policy retry crashed for ${id}: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );

    return this.repo.listDocuments();
  }
}
```

Create `src/contexts/platform/application/queries/get-policy-documents.query.ts`:

```ts
// src/contexts/platform/application/queries/get-policy-documents.query.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { PolicyDocumentSummary } from '../../domain/policy.types';
import { PolicyRepository } from '../../infrastructure/policy.repository';

export class GetPolicyDocumentsQuery {}

@QueryHandler(GetPolicyDocumentsQuery)
export class GetPolicyDocumentsHandler
  implements IQueryHandler<GetPolicyDocumentsQuery, PolicyDocumentSummary[]>
{
  constructor(private readonly repo: PolicyRepository) {}
  execute(): Promise<PolicyDocumentSummary[]> {
    return this.repo.listDocuments();
  }
}
```

- [ ] **Step 4: Run handler tests to verify they pass**

Run: `npx jest src/contexts/platform/application/commands/upload-policy-document.command.spec.ts src/contexts/platform/application/commands/retry-policy-ingestion.command.spec.ts`
Expected: PASS — 9 passed

- [ ] **Step 5: Add the DTO**

Append to `src/contexts/platform/interface/dto/platform.dto.ts` (end of file):

```ts
/* ---------------------- Policy handbook (RAG, Module C) ---------------------- */

const POLICY_SOURCE_TYPES = ['pdf', 'text'] as const;

export class UploadPolicyDocumentDto {
  @ApiProperty({ maxLength: 200 }) @IsString() @IsNotEmpty() @MaxLength(200) title!: string;

  @ApiProperty({ enum: POLICY_SOURCE_TYPES })
  @IsIn(POLICY_SOURCE_TYPES as unknown as string[])
  sourceType!: 'pdf' | 'text';

  // Base64-encoded handbook PDF. main.ts caps JSON bodies at 8MB; this 6MB
  // cap (≈4.5MB file) mirrors the résumé-upload pattern in recruitment.dto.ts.
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(6_000_000)
  base64?: string;

  // Pasted handbook text / markdown.
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500_000)
  text?: string;
}
```

(All decorators used — `ApiProperty`, `IsString`, `IsNotEmpty`, `IsOptional`, `IsIn`, `MaxLength` — are already imported at the top of this file; no import changes needed.)

- [ ] **Step 6: Add the controller endpoints**

In `src/contexts/platform/interface/platform.controller.ts`:

Add to the existing import from `'../application/...'` section (new import lines after the calc.handlers import):

```ts
import { UploadPolicyDocumentCommand } from '../application/commands/upload-policy-document.command';
import { DeletePolicyDocumentCommand } from '../application/commands/delete-policy-document.command';
import { RetryPolicyIngestionCommand } from '../application/commands/retry-policy-ingestion.command';
import { GetPolicyDocumentsQuery } from '../application/queries/get-policy-documents.query';
```

Add `UploadPolicyDocumentDto` to the existing `./dto/platform.dto` import list.

Append inside the class, after the calc-rules endpoints:

```ts
  /* ---------------- Policy handbook (RAG knowledge base) ----------------- */

  @Get('policy-documents')
  @Roles('HR_ADMIN')
  getPolicyDocuments() {
    return this.queries.execute(new GetPolicyDocumentsQuery());
  }

  @Post('policy-documents')
  @Roles('HR_ADMIN')
  uploadPolicyDocument(@Body() body: UploadPolicyDocumentDto) {
    return this.commands.execute(new UploadPolicyDocumentCommand(body));
  }

  @Delete('policy-documents/:id')
  @Roles('HR_ADMIN')
  deletePolicyDocument(@Param('id') id: string) {
    return this.commands.execute(new DeletePolicyDocumentCommand(id));
  }

  @Post('policy-documents/:id/retry')
  @Roles('HR_ADMIN')
  retryPolicyIngestion(@Param('id') id: string) {
    return this.commands.execute(new RetryPolicyIngestionCommand(id));
  }
```

- [ ] **Step 7: Wire the module**

Replace `src/contexts/platform/platform.module.ts` with:

```ts
// src/contexts/platform/platform.module.ts
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AiModule } from 'src/platform/ai/ai.module';
import { PlatformController } from './interface/platform.controller';
import { PlatformRepository } from './infrastructure/platform.repository';
import { CopilotService } from './infrastructure/copilot.service';
import { PolicyRepository } from './infrastructure/policy.repository';
import { PolicyIngestionService } from './infrastructure/policy-ingestion.service';
import { PolicyRetrievalService } from './infrastructure/policy-retrieval.service';
import { GetSettingsHandler } from './application/queries/get-settings.query';
import { GetAgentRunsHandler } from './application/queries/get-agent-runs.query';
import { AskCopilotHandler } from './application/queries/ask-copilot.query';
import { GetPolicyDocumentsHandler } from './application/queries/get-policy-documents.query';
import { SaveSettingsHandler } from './application/commands/save-settings.command';
import { CreateAgentRunHandler } from './application/commands/create-agent-run.command';
import { SetAgentRunStatusHandler } from './application/commands/set-agent-run-status.command';
import { UploadPolicyDocumentHandler } from './application/commands/upload-policy-document.command';
import { DeletePolicyDocumentHandler } from './application/commands/delete-policy-document.command';
import { RetryPolicyIngestionHandler } from './application/commands/retry-policy-ingestion.command';
import {
  CreateCalcRuleHandler,
  DeleteCalcRuleHandler,
  GetCalcRulesHandler,
  UpdateCalcRuleHandler,
} from './application/calc.handlers';

@Module({
  imports: [CqrsModule, AiModule],
  controllers: [PlatformController],
  providers: [
    PlatformRepository,
    CopilotService,
    PolicyRepository,
    PolicyIngestionService,
    PolicyRetrievalService,
    GetSettingsHandler,
    GetAgentRunsHandler,
    AskCopilotHandler,
    GetPolicyDocumentsHandler,
    SaveSettingsHandler,
    CreateAgentRunHandler,
    SetAgentRunStatusHandler,
    UploadPolicyDocumentHandler,
    DeletePolicyDocumentHandler,
    RetryPolicyIngestionHandler,
    GetCalcRulesHandler,
    CreateCalcRuleHandler,
    UpdateCalcRuleHandler,
    DeleteCalcRuleHandler,
  ],
  // Module D (chat agent) injects PolicyRetrievalService via PlatformModule.
  exports: [PolicyRetrievalService],
})
export class PlatformModule {}
```

Note: if Module A already added `AiModule` to this file's imports, keep a single entry. If `AiModule` does not export `LLM_PROVIDER_CHAT`, that is a Module A bug — do not work around it here.

- [ ] **Step 8: Full unit suite + lint**

Run: `npm test`
Expected: PASS — all suites green (including the four new spec files)

Run: `npm run lint`
Expected: no errors

- [ ] **Step 9: Commit**

```bash
git add src/contexts/platform
git commit -m "feat(platform): policy-document endpoints (upload/list/delete/retry) with async ingestion"
```

---

### Task 6: Backend e2e — refusal path, CRUD, tenant isolation (key-free)

**Files:**
- Test: `test/platform-policies.e2e-spec.ts`

**Interfaces:**
- Consumes: Task 5's endpoints; `createE2eApp`, `fetchSeededUsers`, `KEY`, `SEED_COMPANY_ID` from `test/e2e-utils.ts`; raw `PrismaService` for cross-tenant fixtures (the legitimate escape hatch, same as `tenant-isolation.e2e-spec.ts`).
- Produces: nothing downstream — this is the verification gate for the backend half.

**Stubbing decision (stated explicitly, per spec):** the key-free e2e does NOT stub a fake provider into DI. With no `GEMINI_API_KEY`, Module A's provider reports `isLive() === false`, and per the design spec **handbook ingestion is refused with a clear message** — text uploads included (chunks without embeddings would be dead weight). So this suite asserts the *refusal* path (503 + message), plus validation, HR gating, list/delete CRUD, and tenant isolation over fixture documents created with the raw system Prisma client. The happy ingestion path is covered by Task 3's unit tests (mocked provider) and by the opt-in live e2e planned in Module D's integration pass.

Run from the backend repo root. Prereqs: `npm run db:up && npm run prisma:migrate && npm run db:seed`.

- [ ] **Step 1: Write the e2e spec**

Create `test/platform-policies.e2e-spec.ts`:

```ts
// Policy handbook RAG (Module C), key-free e2e: without GEMINI_API_KEY the
// upload/retry endpoints refuse with a clear 503 (spec: "handbook ingestion
// is refused with a clear message"); list/delete work over fixtures and are
// strictly tenant-scoped and HR-gated.
import 'dotenv/config';
process.env.FIREBASE_AUTH_DISABLED ??= '1';
// The refusal path under test requires NO Gemini key, deterministically —
// clear anything .env may have loaded before the app boots.
delete process.env.GEMINI_API_KEY;

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2eApp, fetchSeededUsers, KEY, SEED_COMPANY_ID, SeededUsers } from './e2e-utils';
import { PrismaService } from '../src/platform/database/prisma.service';

describe('Platform policy documents (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let users: SeededUsers;
  const suffix = Date.now().toString(36);
  let companyBId: string;
  let userBId: string;
  let docAId: string;
  let docBId: string;

  const as = (userId: string) => ({ 'x-internal-key': KEY, 'x-actor-id': userId });

  beforeAll(async () => {
    app = await createE2eApp();
    prisma = app.get(PrismaService);
    users = await fetchSeededUsers(app);

    // Fixture documents via the raw system client — the upload endpoint
    // (correctly) refuses to ingest without a Gemini key.
    const docA = await prisma.policyDocument.create({
      data: {
        companyId: SEED_COMPANY_ID,
        title: `Alpha Handbook ${suffix}`,
        sourceType: 'text',
        status: 'Failed',
      },
    });
    docAId = docA.id;
    // A stored chunk text (embedding pending) — makes docA retry-eligible, so
    // the retry test exercises the key refusal, not the "nothing stored" 400.
    await prisma.policyChunk.create({
      data: {
        documentId: docAId,
        companyId: SEED_COMPANY_ID,
        ordinal: 0,
        heading: 'Vacation',
        text: 'Employees receive 15 vacation days.',
        embedding: [],
      },
    });

    // Company B with its own HR admin + handbook (tenant-isolation fixture,
    // mirrors tenant-isolation.e2e-spec.ts).
    const companyB = await prisma.company.create({
      data: { name: `PolicyBeta ${suffix}`, slug: `policy-beta-${suffix}` },
    });
    companyBId = companyB.id;
    const empB = await prisma.employee.create({
      data: {
        companyId: companyBId,
        name: 'Beta Admin',
        title: 'HR Admin',
        department: 'People',
        province: 'ON',
        email: `policy-beta-${suffix}@test.com`,
        hireDate: new Date('2022-01-01'),
        birthDate: new Date('1980-01-01'),
        salary: 100000,
      },
    });
    const userB = await prisma.user.create({
      data: { companyId: companyBId, employeeId: empB.id, role: 'HR_ADMIN' },
    });
    userBId = userB.id;
    const docB = await prisma.policyDocument.create({
      data: {
        companyId: companyBId,
        title: `Beta Handbook ${suffix}`,
        sourceType: 'text',
        status: 'Ready',
      },
    });
    docBId = docB.id;
  });

  afterAll(async () => {
    await prisma.policyDocument
      .deleteMany({ where: { id: { in: [docAId, docBId] } } })
      .catch(() => undefined);
    if (companyBId) {
      await prisma.company.delete({ where: { id: companyBId } }).catch(() => undefined);
    }
    await app.close();
  });

  it('policy endpoints are HR-gated (employee gets 403)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/platform/policy-documents')
      .set(as(users.employee.id))
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/platform/policy-documents')
      .set(as(users.employee.id))
      .send({ title: 'Nope', sourceType: 'text', text: 'nope' })
      .expect(403);
  });

  it('upload is refused with a clear message when no GEMINI_API_KEY is set (503)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/platform/policy-documents')
      .set(as(users.hr.id))
      .send({
        title: 'Employee Manual 2026',
        sourceType: 'text',
        text: '# Leave\n\nEveryone gets 15 days.',
      })
      .expect(503);
    expect(String(res.body.message)).toMatch(/GEMINI_API_KEY/);
  });

  it('rejects a text upload without text (400)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/platform/policy-documents')
      .set(as(users.hr.id))
      .send({ title: 'Employee Manual', sourceType: 'text' })
      .expect(400);
  });

  it('rejects a pdf upload without base64 (400)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/platform/policy-documents')
      .set(as(users.hr.id))
      .send({ title: 'Employee Manual', sourceType: 'pdf' })
      .expect(400);
  });

  it('rejects an unknown sourceType (400, DTO validation)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/platform/policy-documents')
      .set(as(users.hr.id))
      .send({ title: 'Employee Manual', sourceType: 'docx', text: 'x' })
      .expect(400);
  });

  it("lists only the caller's tenant's documents, with status", async () => {
    const resA = await request(app.getHttpServer())
      .get('/api/v1/platform/policy-documents')
      .set(as(users.hr.id))
      .expect(200);
    const idsA = (resA.body as { id: string }[]).map((d) => d.id);
    expect(idsA).toContain(docAId);
    expect(idsA).not.toContain(docBId);

    const resB = await request(app.getHttpServer())
      .get('/api/v1/platform/policy-documents')
      .set(as(userBId))
      .expect(200);
    const rowsB = resB.body as { id: string; status: string; chunkCount: number }[];
    expect(rowsB.map((d) => d.id)).toContain(docBId);
    expect(rowsB.map((d) => d.id)).not.toContain(docAId);
    expect(rowsB.find((d) => d.id === docBId)?.status).toBe('Ready');
  });

  it("cannot delete another tenant's document (404), and it survives", async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/platform/policy-documents/${docBId}`)
      .set(as(users.hr.id))
      .expect(404);
    const resB = await request(app.getHttpServer())
      .get('/api/v1/platform/policy-documents')
      .set(as(userBId))
      .expect(200);
    expect((resB.body as { id: string }[]).map((d) => d.id)).toContain(docBId);
  });

  it("cannot retry another tenant's document (404)", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/platform/policy-documents/${docBId}/retry`)
      .set(as(users.hr.id))
      .expect(404);
  });

  it('retry on a non-Failed document is a 400', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/platform/policy-documents/${docBId}/retry`)
      .set(as(userBId))
      .expect(400);
  });

  it('retry on a Failed document is refused without a key (503)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/platform/policy-documents/${docAId}/retry`)
      .set(as(users.hr.id))
      .expect(503);
    expect(String(res.body.message)).toMatch(/GEMINI_API_KEY/);
  });

  it('deletes its own document and returns the refreshed list', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/platform/policy-documents/${docAId}`)
      .set(as(users.hr.id))
      .expect(200);
    expect((res.body as { id: string }[]).map((d) => d.id)).not.toContain(docAId);
  });
});
```

- [ ] **Step 2: Run the e2e suite (DB must be up, migrated, seeded)**

```bash
npm run db:up && npm run prisma:migrate && npm run db:seed
npx jest --config ./test/jest-e2e.json --runInBand --testPathPattern 'platform-policies\.e2e-spec\.ts$'
```

Expected: PASS — 11 passed. If a test fails, fix the Task 5 code (not the test) unless the test itself contradicts the spec.

- [ ] **Step 3: Run the whole e2e suite to check for regressions**

Run: `npm run test:e2e`
Expected: PASS — all suites green

- [ ] **Step 4: Commit**

```bash
git add test/platform-policies.e2e-spec.ts
git commit -m "test(platform): policy-document e2e — key refusal, validation, CRUD, tenant isolation"
```

---

### Task 7: Frontend — regenerate API types + Server Actions

**Files:**
- Regenerate: `lib/api/generated/openapi.d.ts` (via `npm run api:generate`)
- Create: `app/actions/policies.ts`

**Interfaces:**
- Consumes: Task 5's HTTP endpoints (now present in the regenerated OpenAPI types); `authedApi` from `lib/api/client.ts`; `ACTOR_COOKIE` from `lib/actor.ts`.
- Produces (used by Task 8):
  - `PolicyDocumentSummary { id: string; title: string; sourceType: "pdf" | "text"; status: "Processing" | "Ready" | "Failed"; uploadedAt: string; chunkCount: number }`
  - `listPolicyDocuments(): Promise<PolicyDocumentSummary[]>`
  - `uploadPolicyDocument(input: { title: string; sourceType: "pdf" | "text"; base64?: string; text?: string }): Promise<PolicyDocumentSummary[]>`
  - `deletePolicyDocument(id: string): Promise<PolicyDocumentSummary[]>`
  - `retryPolicyIngestion(id: string): Promise<PolicyDocumentSummary[]>`
  - All mutations throw `Error` with the backend's message on failure (the 503 refusal message surfaces verbatim in the UI) and `revalidatePath("/admin/settings/policies")`.

- [ ] **Step 1: Regenerate the typed API client (backend must be running)**

```bash
cd "/Users/ajaypradeepm/Work/Projects/Hustle Projects/Localninja/ninja-hr/ninja-hr-backend"
npm run db:up && npm run prisma:migrate
npm run start:dev &
sleep 15 && curl -sf http://localhost:4000/api/v1/health
cd "/Users/ajaypradeepm/Work/Projects/Hustle Projects/Localninja/ninja-hr/ninja-hr-frontend"
npm run api:generate
grep -c "policy-documents" lib/api/generated/openapi.d.ts
```

Expected: `curl` prints a health payload; `api:generate` rewrites `lib/api/generated/openapi.d.ts`; the final `grep -c` prints a non-zero count (the new `/api/v1/platform/policy-documents` paths are present). Stop the backend dev server afterwards if you started it (`kill %1`).

- [ ] **Step 2: Write the Server Actions**

Create `app/actions/policies.ts` (frontend repo):

```ts
"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { authedApi } from "@/lib/api/client";
import { ACTOR_COOKIE } from "@/lib/actor";

export type PolicyDocumentStatus = "Processing" | "Ready" | "Failed";

export interface PolicyDocumentSummary {
  id: string;
  title: string;
  sourceType: "pdf" | "text";
  status: PolicyDocumentStatus;
  /** ISO date-time of upload. */
  uploadedAt: string;
  chunkCount: number;
}

async function client() {
  const store = await cookies();
  return authedApi("admin", store.get(ACTOR_COOKIE)?.value);
}

async function unwrap<T>(
  promise: Promise<{ data?: unknown; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await promise;
  if (error !== undefined || !response.ok) {
    const detail =
      error && typeof error === "object" && "message" in error
        ? String((error as { message: unknown }).message)
        : `${response.status} ${response.statusText}`;
    throw new Error(detail);
  }
  return data as T;
}

export async function listPolicyDocuments(): Promise<PolicyDocumentSummary[]> {
  const api = await client();
  return unwrap<PolicyDocumentSummary[]>(api.GET("/api/v1/platform/policy-documents"));
}

export async function uploadPolicyDocument(input: {
  title: string;
  sourceType: "pdf" | "text";
  base64?: string;
  text?: string;
}): Promise<PolicyDocumentSummary[]> {
  const api = await client();
  const docs = await unwrap<PolicyDocumentSummary[]>(
    api.POST("/api/v1/platform/policy-documents", { body: input as never }),
  );
  revalidatePath("/admin/settings/policies");
  return docs;
}

export async function deletePolicyDocument(id: string): Promise<PolicyDocumentSummary[]> {
  const api = await client();
  const docs = await unwrap<PolicyDocumentSummary[]>(
    api.DELETE("/api/v1/platform/policy-documents/{id}", { params: { path: { id } } }),
  );
  revalidatePath("/admin/settings/policies");
  return docs;
}

export async function retryPolicyIngestion(id: string): Promise<PolicyDocumentSummary[]> {
  const api = await client();
  const docs = await unwrap<PolicyDocumentSummary[]>(
    api.POST("/api/v1/platform/policy-documents/{id}/retry", { params: { path: { id } } }),
  );
  revalidatePath("/admin/settings/policies");
  return docs;
}
```

- [ ] **Step 3: Verify types and lint**

```bash
cd "/Users/ajaypradeepm/Work/Projects/Hustle Projects/Localninja/ninja-hr/ninja-hr-frontend"
npx tsc --noEmit
npm run lint
```

Expected: both clean. If `tsc` cannot resolve the new endpoint paths, Step 1 did not run against a backend containing Task 5 — redo it.

- [ ] **Step 4: Commit (frontend repo)**

```bash
git add lib/api/generated/openapi.d.ts app/actions/policies.ts
git commit -m "feat(policies): server actions + regenerated API types for policy handbook endpoints"
```

---

### Task 8: Frontend — Policies admin page + Settings entry card

**Files:**
- Create: `app/admin/settings/policies/page.tsx`
- Create: `app/admin/settings/policies/policies-view.tsx`
- Modify: `app/admin/settings/settings-view.tsx` (add a linking card; the Settings page is a card grid with no tabs, so Policies is a sibling route — decided against the existing Settings IA per the spec's "final placement decided in the plan")

**Interfaces:**
- Consumes: Task 7's actions and `PolicyDocumentSummary`; `Badge`, `Button`, `Card`, `CardHeader`, `EmptyState`, `PageHeader`, `LinkButton` from `components/ui.tsx` (Badge tones: `amber`/`green`/`red`; Button variants: `primary`/`outline`/`danger`); `cn` from `lib/utils.ts`; lucide icons.
- Produces: `/admin/settings/policies` — upload PDF (client-side base64, same `arrayBuffer` → `btoa` loop as `components/recruitment/apply-form.tsx`) or paste text; status chip Processing/Ready/Failed with Retry on Failed; replace/delete. No `lib/nav.ts` change — the page lives under Settings, reached via the new Settings card (sidebar continues to highlight Settings).

- [ ] **Step 1: Create the server page**

Create `app/admin/settings/policies/page.tsx`:

```tsx
export const dynamic = "force-dynamic";

import { listPolicyDocuments } from "@/app/actions/policies";
import { PoliciesView } from "./policies-view";

export default async function PoliciesPage() {
  const documents = await listPolicyDocuments();
  return <PoliciesView initial={documents} />;
}
```

- [ ] **Step 2: Create the client view**

Create `app/admin/settings/policies/policies-view.tsx`:

```tsx
"use client";

import * as React from "react";
import { BookOpen, FileUp, RefreshCw, Trash2, Upload } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  deletePolicyDocument,
  listPolicyDocuments,
  retryPolicyIngestion,
  uploadPolicyDocument,
  type PolicyDocumentSummary,
} from "@/app/actions/policies";

// ~5.4MB after base64 — safely under the backend DTO's 6MB cap.
const MAX_PDF_BYTES = 4 * 1024 * 1024;

const STATUS_TONE: Record<PolicyDocumentSummary["status"], "amber" | "green" | "red"> = {
  Processing: "amber",
  Ready: "green",
  Failed: "red",
};

/** Client-side file → base64 (same pattern as the careers apply form). */
function toBase64(buf: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function PoliciesView({ initial }: { initial: PolicyDocumentSummary[] }) {
  const [docs, setDocs] = React.useState<PolicyDocumentSummary[]>(initial);
  const [mode, setMode] = React.useState<"pdf" | "text">("pdf");
  const [title, setTitle] = React.useState("");
  const [file, setFile] = React.useState<{ name: string; base64: string } | null>(null);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const processing = docs.some((d) => d.status === "Processing");

  // Ingestion finishes in the background — poll while anything is Processing.
  React.useEffect(() => {
    if (!processing) return;
    const timer = setInterval(() => {
      void listPolicyDocuments().then(setDocs).catch(() => undefined);
    }, 3000);
    return () => clearInterval(timer);
  }, [processing]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    if (f.type !== "application/pdf") {
      setError("Please choose a PDF file.");
      return;
    }
    if (f.size > MAX_PDF_BYTES) {
      setError("The handbook PDF must be under 4MB.");
      return;
    }
    setFile({ name: f.name, base64: toBase64(await f.arrayBuffer()) });
    if (!title.trim()) setTitle(f.name.replace(/\.pdf$/i, ""));
  }

  const canUpload =
    !busy && title.trim().length > 0 && (mode === "pdf" ? file !== null : text.trim().length > 0);

  async function upload() {
    if (!canUpload) return;
    setBusy(true);
    setError(null);
    try {
      setDocs(
        await uploadPolicyDocument({
          title: title.trim(),
          sourceType: mode,
          base64: mode === "pdf" ? file?.base64 : undefined,
          text: mode === "text" ? text.trim() : undefined,
        }),
      );
      setTitle("");
      setFile(null);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function retry(id: string) {
    setBusy(true);
    setError(null);
    try {
      setDocs(await retryPolicyIngestion(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (
      !window.confirm(
        "Delete this handbook? The AI assistant will stop answering policy questions.",
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      setDocs(await deletePolicyDocument(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Policy Handbook"
        subtitle="Upload your employee manual so the AI assistant can answer policy questions with citations."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Current handbook */}
        <Card className="card-pad">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-brand-600 dark:text-brand-400" /> Current
                Handbook
              </span>
            }
          />
          {docs.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                icon={<BookOpen className="h-8 w-8" />}
                title="No handbook uploaded"
                description="Upload a PDF or paste the handbook text — the assistant answers policy questions only from this document."
              />
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {docs.map((d) => (
                <li key={d.id} className="rounded-2xl border border-line p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{d.title}</p>
                      <p className="text-xs text-ink-muted">
                        {d.sourceType === "pdf" ? "PDF" : "Pasted text"} · uploaded{" "}
                        {new Date(d.uploadedAt).toLocaleDateString()}
                        {d.status === "Ready" && ` · ${d.chunkCount} sections indexed`}
                      </p>
                    </div>
                    <Badge tone={STATUS_TONE[d.status]}>
                      {d.status === "Processing" ? "Processing…" : d.status}
                    </Badge>
                  </div>
                  <div className="mt-3 flex gap-2">
                    {d.status === "Failed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void retry(d.id)}
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Retry
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busy}
                      onClick={() => void remove(d.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Upload / replace */}
        <Card className="card-pad">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-brand-600 dark:text-brand-400" />{" "}
                {docs.length > 0 ? "Replace Handbook" : "Upload Handbook"}
              </span>
            }
          />
          <p className="mt-1 text-xs text-ink-muted">
            One handbook per workspace — uploading a new one replaces the current handbook.
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <label className="field-label">Title</label>
              <input
                className="field-input"
                placeholder="Employee Manual 2026"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              {(["pdf", "text"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                    mode === m
                      ? "border-brand-300 bg-brand-50 text-brand-700 dark:text-brand-400"
                      : "border-line text-ink-muted hover:bg-canvas",
                  )}
                >
                  {m === "pdf" ? "Upload PDF" : "Paste text"}
                </button>
              ))}
            </div>
            {mode === "pdf" ? (
              <div>
                <label className="field-label">Handbook PDF (max 4MB)</label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => void onFile(e)}
                  className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-500 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-brand-600"
                />
                {file && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-muted">
                    <FileUp className="h-3.5 w-3.5" /> {file.name}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <label className="field-label">
                  Handbook text (markdown headings become citable sections)
                </label>
                <textarea
                  className="field-input min-h-[180px]"
                  placeholder={"# Vacation\n\nEmployees receive…"}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </div>
            )}
            {error && <p className="text-xs text-red-600 dark:text-red-300">{error}</p>}
            <Button onClick={() => void upload()} disabled={!canUpload}>
              <Upload className="h-4 w-4" />{" "}
              {busy ? "Uploading…" : docs.length > 0 ? "Replace handbook" : "Upload handbook"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add the entry card to Settings**

In `app/admin/settings/settings-view.tsx`:

1. Add `BookOpen` to the existing `lucide-react` import list (it currently imports `Building2, ListChecks, MapPin, ShieldCheck, Plug, Palette, Check, CircleCheckBig, Save`).
2. Add `LinkButton` to the existing `@/components/ui` import (currently `Card, CardHeader, Badge, PageHeader, Button`).
3. Insert this card between the `{/* Branding */}` card's closing `</Card>` and the `{/* Integrations */}` comment:

```tsx
        {/* Policy handbook (AI assistant knowledge base) */}
        <Card className="card-pad lg:col-span-2">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-brand-600 dark:text-brand-400" /> Policy
                Handbook
              </span>
            }
            action={
              <LinkButton href="/admin/settings/policies" size="sm" variant="outline">
                Manage
              </LinkButton>
            }
          />
          <p className="mt-1 text-xs text-ink-muted">
            Upload your employee manual so the AI assistant can answer policy questions with
            citations. One handbook per workspace; replace it any time.
          </p>
        </Card>
```

- [ ] **Step 4: Verify types, lint, and the page end-to-end (dev)**

```bash
cd "/Users/ajaypradeepm/Work/Projects/Hustle Projects/Localninja/ninja-hr/ninja-hr-frontend"
npx tsc --noEmit
npm run lint
```

Expected: both clean.

Manual smoke test (backend from Task 7 Step 1 still running, or restart it):

```bash
npm run dev
```

Open `http://localhost:3000/admin/settings` → the "Policy Handbook" card shows with a Manage button → `http://localhost:3000/admin/settings/policies` renders the empty state; pasting text with a title and clicking "Upload handbook" surfaces the refusal message ("AI is not configured — handbook ingestion requires GEMINI_API_KEY…") in the error line — this is the correct key-free behavior, not a bug.

- [ ] **Step 5: Commit (frontend repo)**

```bash
git add app/admin/settings/policies app/admin/settings/settings-view.tsx
git commit -m "feat(policies): admin policy-handbook page (upload/replace/retry/delete) + settings entry card"
```

---

## Self-review (run before handing off)

1. **Spec coverage (Module C):** data model — assumed pre-existing, verified by grep (Global Constraints). Upload PDF/text, HR_ADMIN, replace-deletes-prior — Task 5. PDF → markdown via inline document + extraction prompt — Task 3. Heading/paragraph chunking ~1500/200 with nearest heading — Task 1. Batched embedding + Processing→Ready/Failed async with retry — Tasks 3+5. Retrieval: 1 embed call, in-app cosine, top-5 ≥ 0.5, typed excerpts — Tasks 2+4 (`PolicyExcerpt` exact). No-key refusal — Tasks 5+6. Admin UI with status chip/Retry/replace/delete — Task 8. "POLICY EXCERPTS prompt block" and "no handbook → agent says so" are Module D consumption concerns, out of this plan by assignment.
2. **Placeholder scan:** every code step contains complete, final code; every run step has an exact command and expected outcome; no TBDs.
3. **Type consistency:** `PolicyChunkDraft`/`chunkPolicyText` (T1) used by T3; `topKBySimilarity` (T2) used by T4; `PolicyRepository` method names in T3 match every mock and call in T3–T5; `PolicyExcerpt`/`PolicyDocumentSummary`/`AI_NOT_CONFIGURED_MESSAGE` (T1) used in T4/T5/T6; frontend `PolicyDocumentSummary` mirrors the backend shape; constructor argument orders match between services and their spec mocks.
