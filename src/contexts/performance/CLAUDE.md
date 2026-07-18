# [PERFORMANCE] Reviews, PIPs, probation, growth (goals/1:1s/kudos)

## Why / design

Two access models in one context: reviews/PIPs are company-wide HR_ADMIN
records; growth endpoints are actor-scoped (owner / department manager / HR).
Manager identity = role + department match (`actor.department`), never name.
The probation sweep runs when HR opens the dashboard — no cron — and is
idempotent (one review per employee, agent-runs deduped by intent).

## Features

Reviews: Draft → Self-Evaluation → Manager-Evaluation → Calibrated →
Completed (`domain/review-flow.ts`) · PIPs · 90-day probation sweep (Day-60
init, Day-80 escalate) · goals + weekly progress · 1-on-1 shared agendas ·
peer feedback · kudos.

## Business rules

- **Participatory review flow** (modeled on Lattice/BambooHR/15Five): HR
  creates (Draft) and launches (→ Self-Evaluation); the EMPLOYEE submits
  their own self-assessment (`POST reviews/:id/self`, owner-only,
  auto-advances); the ASSIGNED manager (`managerId`, reporting line — or HR)
  submits the evaluation + proposed rating (`POST reviews/:id/manager`,
  auto-advances to Calibrated); HR calibrates the score and completes
  (shares); the employee acknowledges (`POST reviews/:id/acknowledge`,
  Completed-only, idempotent).
- **Independence gating** in `getMyReviews`: the manager can't see an
  UNSUBMITTED self-eval; the employee can't see the manager eval or score
  until Completed. Participation routes carry no @Roles — relationship
  checks live in the repository.
- State advance is race-guarded: `updateMany where {id, state: current}` — a
  double-click can't skip a stage.
- PIP integrity: issuing manager auto-signs; `signedByEmployee` stays false
  until the employee actually signs — never fabricate acknowledgment.
- **Goal-weight guardrail** (`domain/goal-weight-guardrail.ts`): >15
  percentage-point change on an active/signed goal → 409 with
  `WEIGHT_GUARDRAIL` marker (frontend keys on it), audit-logged, routed to
  mutual-consent approvals (constructive-dismissal protection). Within
  threshold = logged + accepted. Completed goals can't be re-weighted.
- Growth access: progress = owner/HR; weight = HR or dept manager; 1-on-1
  writes = employee/dept manager/HR; feedback response = only the asked
  colleague (HR excluded); no self-feedback or self-kudos.

## Gotchas

- Goals have NO weight column — applied/blocked changes live on the
  `goalUpdate` trail.
- 1-on-1 talking points/action items are JSON arrays on the row (server
  `randomUUID()` ids), not tables.
- `getGrowth` with no `actor.employeeId` returns an empty overview silently.
- PIPs link by name match; orphan PIPs (null employeeId) are possible.
