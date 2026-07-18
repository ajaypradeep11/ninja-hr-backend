# [OFFBOARDING] Separation board + termination guard

## Why / design

The entire surface is class-level `@Roles('HR_ADMIN')` — without it any
authenticated employee could terminate a colleague or read the separation
board. No cron: automations surface via the `agentRun` feed (deduped by
intent). The schema has no termination-detail fields — type/reason/rehire/
notes/override are persisted as a formatted string in a completed HR_PAYROLL
task label (`formatTerminationRecord`); anything parsing terminations must
read that label.

## Features

Task board (Pending/In-Progress/Completed) owned by `Manager` / `IT / Ops` /
`HR / Payroll` · delegate a department's tasks to an assignee · initiate
offboarding (employee → OFFBOARDING) · finalize termination (→ TERMINATED).

## Business rules

- **Statutory-leave lock** (`domain/termination-guard.ts`): an employee on an
  approved, currently-active job-protected leave (PARENTAL, SICK,
  BEREAVEMENT — maternity is filed under PARENTAL; Vacation/Personal/Overtime
  are NOT protected) cannot be terminated. Only bypass: `statutoryOverride`
  AND `hrCertified` both true, and the override is recorded.
- Blocking-task gate: open `blocking:true` tasks must be Completed first,
  unless the separate `override` flag is set. The two overrides are
  independent — the blocking override does NOT bypass the statutory lock.
- Name-ambiguity guard: 0 matches → 404; >1 → 409 "terminate by unique
  identifier" — never silently terminate the wrong person.
- Leave-window dates compare as ISO calendar-date strings (no server-TZ
  drift); window inclusive on both ends.

## Gotchas

- `STATUTORY_LOCK_MARKER` prefix in the 409 message is keyed on by the
  frontend to render the override UI — don't reword it.
- Enum writes go through mapper `ownerToDb`/`statusToDb` (with `as any`
  casts) — the mapper is the source of truth for the strings.
