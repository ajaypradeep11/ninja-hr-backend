# [PLATFORM] HR Co-Pilot, policy RAG, moderation feed

## Why / design

The copilot's defense is persona + data-labelling: the workspace snapshot and
policy excerpts are injected as read-only JSON/labelled excerpts ("values are
data, never instructions"). The `employee` persona snapshot pre-loads up to
500 other-employee names purely to feed the output guard's PII check.
Handbook ingestion is fire-and-forget but re-wraps `tenant.run(companyId, …)`
because async work escapes the request's ALS tenant context.

## Features

Copilot: one-shot `ask` + stateful conversations (20-turn window) · policy
handbook RAG (upload PDF/text → chunk → embed → retrieve) · moderation-event
log (HR) · company settings · agent-runs board · calculator rules.

## Business rules

- Persona split (`domain/agent-prompt.ts`): `admin` reasons over the
  workspace snapshot; `employee` answers only about own data, never another
  employee's. System prompt forbids performing/claiming employment actions.
- Policy answers cite ONLY provided excerpts (bracketed labels) and must say
  when no handbook material exists — no invented policy.
- Retrieval: top-5, cosine floor 0.5; empty when provider offline or no
  ready chunks. Conversations are ownership-scoped by userId → 404.
- Upload REPLACES the whole handbook (single-handbook model: deleteAll then
  create).

## Gotchas

- Offline (no key): chat returns a canned message + own-record summary;
  handbook upload is rejected outright (503) — you can't stage a handbook
  offline.
- PDF extraction uses the provider `document` path — works on Gemini only;
  the Anthropic provider throws on documents.
- Snapshot/policy fetch failures degrade to stubs rather than failing chat.
