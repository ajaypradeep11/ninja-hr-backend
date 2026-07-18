# [ONBOARDING] Cases, checklists, invite tokens, document verification

## Why / design

Two lanes: HR (session) and the new hire via an unguessable invite token
(`inv_` + 18 random bytes) with no session. The Employee/User row is
provisioned at invite-acceptance as `PRE_HIRE` (hidden from the directory)
with the Firebase UID stamped, so ActorGuard resolves the hire on their first
request; activation promotes the SAME row to ACTIVE. Status is never set
directly — `settle()` recomputes it after every mutation
(`domain/onboarding-status.ts`).

## Features

HR: create case (auto province+department checklist), pipeline dashboard,
edit checklist/assignees/tasks, verify/reject documents, activate, download
SIN/banking uploads. Hire (token lane): view case, accept invite (password ≥10
or verified Google), submit profile, mark forms, upload docs, consent, finalize.

## Business rules

- Status machine: `Invited` → `Forms In Progress` (first form tick, never
  skipped) → all forms done → `Ready to Activate` iff activation gates pass,
  else `Pending Verification`. `Active` is terminal.
- Activation gates: 100% forms + all `blocking` checklist tasks Completed +
  ALL documents `Verified` (human-in-the-loop). Policy attachment is NOT a
  gate. `ActivateCommand` throws Conflict listing failed gates.
- Rejected docs are parked as `Pending` (schema has no REJECTED) and still
  block activation.
- `submit-profile` is blocked once Active (record becomes HRIS-owned).
  SIN/bank required on first submit; omitted on re-submit = keep on file.
- `finalize` and `activate` are idempotent; activate self-heals stuck
  PRE_HIRE rows and republishes verified docs to the vault on replay.
- accept-invite mirrors signup's takeover guard: refuses adopting a Firebase
  account linked to a DIFFERENT employee; Google token must be verified +
  email-match.
- Pipeline progress is item-weighted (each form/task/doc counts once), not
  the per-case avg — so 5 forms don't outweigh 20 tasks.

## Gotchas

- `rawProfile` is the ONLY unmasked read — never return it to a client, and
  never merge from a masked read (would persist `•••789` as the real SIN).
- Vault publish matches by employeeId link first; name matching is a legacy
  fallback that silently filed nothing when legal name ≠ typed name.
- Nested checklist/audit creates in createCase stamp `companyId` explicitly
  (tenant extension skips nested writes).
- Case reads exclude document `data` bytes; files stream via their own
  endpoint (inline + nosniff, uploads restricted to PDF/PNG/JPEG).
- `saveProfile` propagates `birthdayPrivate` to Employee BY NAME, not id.
