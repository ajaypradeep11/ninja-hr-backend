# [RECRUITMENT] ATS + public careers + candidate portal

## Why / design

Recruiting spans three trust zones — internal ATS (authenticated), public
careers site (no session), candidate portal (token only) — in one context.
Tenant-less flows resolve their company via `TenantResolver` escape hatches:
`runByCompanySlug` (board), `runByRequisitionSlug` (job page + apply; the
requisition slug is globally unique so it identifies the company),
`runByPortalToken` (portal + inbound mail webhook). Candidate-scoped routes
carry NO `@Roles` — access is row-level via `assertCandidateAccess`
(repository ~L884): HR sees all; hiring-team members and the requisition
creator see exactly their candidates; plain-employee panelists thus work
without any admin role.

## Features

Requisition lifecycle (draft → multi-approver → publish) · public job board +
apply with résumé upload/pre-screen · candidate portal by token (status,
withdraw) · pipeline stages, notes, structured scorecards · two-way candidate
comms (manual + inbound-email webhook + demo simulate-reply) · AI: JD
generation, message drafting, résumé parsing, guide import · funnel/source/
time-to-fill/cost KPIs · communication templates · PII purge.

## Business rules

- **Anti-Bias Shield** (`domain/anti-bias.service.ts`): auto-rejection is
  unsupported by design; `assertManualRejection` requires an identified human
  (`actor.employeeId`). AI may only score/flag; only `SetCandidateStageCommand`
  writes stage; rejection templates fire only after a human rejects.
- Stage changes are HR_ADMIN-only; managers/panelists get a read-only
  pipeline — their input is the scorecard. Only HR messages candidates
  (consistent employer brand); automated triggers stay system-generated.
- Approvals (`domain/approval.service.ts`): advance only when EVERY named
  approver approved; any reject → back to Draft; re-submit resets decisions.
- Bill 149 (Ontario): no submit/publish without a salary band; JDs disclose
  salary + AI-screening use. Inclusive-language check is deterministic and
  always runs on JD output.
- Applying requires consent (`@Equals(true)`), stamps consentAt + policy
  version; all required pre-screen questions must be answered.
- Scorecard visibility: drafts private; a panelist sees others' cards only
  after submitting their own (independent-opinion debrief); HR sees submitted
  cards immediately.
- Purge anonymizes in place (idempotent, keeps funnel analytics, nulls
  portalToken); inbound replies to an anonymized candidate throw.

## Stack notes / gotchas

- Résumés are Postgres `Bytes` (~4.5MB max); parsing is best-effort and never
  blocks an application. Download sets nosniff (mimeType is client-supplied).
- Webhook auth = `InboundWebhookGuard` (HMAC over raw body, scoped secret) —
  never the internal key. To: must match `reply+<token>@…`.
- All AI services are key-optional: no key → deterministic template fallback.
- Nested creates (answers, hiring team) set `companyId` explicitly — the
  tenant extension does not stamp nested writes.
- Legacy demo requisitions may be PUBLISHED with null slug — public queries
  filter `slug != null, archivedAt: null`. `company: 'NinjaHR'` is hardcoded
  in template vars (not tenant-derived) — known wart.
- Portal token: `cand_` + 18 random bytes base64url. Apply throttled
  20/10min/IP, inbound 60/min/IP.
