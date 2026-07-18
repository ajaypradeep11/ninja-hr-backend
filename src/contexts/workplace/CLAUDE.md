# [WORKPLACE] Document vault, Letter Lab, training

## Why / design

Three employee-facing workflows that all end in the vault. Employees never
write to the vault directly — documents arrive through platform workflows;
HR uploads are the only manual path. Manager identity is resolved by
`managerId === actor.employeeId`, never by name (the merge payload keeps
`{{manager_name}}` as a string for templates — only the access check moved
to ids).

## Features

Vault: clearance-scoped list, HR upload, file streaming, HR delete ·
Letter Lab: HR template CRUD with `{{merge_fields}}`, single issue,
AI-personalized draft, mass-letter runs (queued for approval) · Training:
HR catalog + assignment + compliance, peer-created courses
(Draft → Pending HR Approval → Published/Rejected), self-service progress.

## Business rules

- Vault clearance at the DB level: HR all; MANAGER sees EMPLOYEE|MANAGER
  access; others EMPLOYEE — and only company-wide docs or their own. File
  stream: HR or owner; non-owners get **404 not 403** (don't leak existence).
- Letters: managers draft/issue only for their own reports (foreign target →
  404). Template CRUD + mass-issue are HR-only; read/issue includes MANAGER.
- Mass letters: excludes TERMINATED; ≤500 employees; AI personalization
  ≤100; mass-issue only QUEUES drafts as an AWAITING_APPROVAL agentRun —
  approval is a separate atomic claim (`updateMany` status flip, 409 if
  already processing) with per-item tenant re-verification.
- AI letter drafts pass facts/base letter as delimited untrusted data through
  `GuardedAgentService`; merge fields preserved byte-for-byte; offline →
  deterministic base letter.
- Training: only PUBLISHED courses assignable; peer course editable only
  pre-publish by its creator; assignment is an idempotent upsert.

## Gotchas

- TWO write paths create vault letters (issueLetter + approval service),
  both hardcoding folder `05_HR_Letters` / access EMPLOYEE — keep in sync.
- Vault list uses Prisma `omit:{data:true}` — never drag file bytes into
  list reads.
- `mapWithConcurrency` caps AI calls at 3 during personalization.
- Rejected peer courses re-submit back to PENDING_APPROVAL (same row).
- Mass-issue controller casts body `as never` — DTO typing bypassed there.
