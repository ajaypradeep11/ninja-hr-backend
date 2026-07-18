# [TIMEOFF] Leave requests + department-manager approvals

## Why / design

Deliberately thin: no domain service layer — the routing rules ARE Prisma
`where` clauses in `infrastructure/timeoff.repository.ts`. Approval belongs to
the requester's **assigned manager** (`Employee.managerId`, the reporting
line), with HR as override. Routing is role-agnostic and does NOT use the
department string — a manager in a different department than their report
still sees and approves it. (Historically this routed by department string +
role MANAGER, which silently dropped cross-department reports; see
`docs/superpowers/` if you need the rationale.)

## Features

Leave request create/list/approve/deny/edit/cancel. Types: Vacation, Sick,
Personal, Parental, Bereavement, Overtime.

## Business rules (all in the repository)

- List scoping is the routing: HR = company-wide log; anyone with direct
  reports = own requests + every request from someone who reports to them
  (their approval queue); employee with no reports = own only. Persona lane
  (no employeeId) = nobody.
- Only the requester's assigned manager (`managerId`) or HR may approve/deny.
- Edit tiers: HR edits anything incl. status; an employee edits only their
  OWN request while PENDING and never the status.
- Cancel: owner while Pending; HR anytime (hard delete).
- Overtime = extra hours worked on one date (1–12h, start==end, days forced
  to 1) — tracked, not deducted.
- Partial-day: single day, max 7h (8h = full day), start==end; `hours` null
  means full day(s). End date may not precede start.

## Gotchas

- Employee resolved by NAME on create (`findFirst({ name })`) — duplicate
  names collide silently. Approval routing, by contrast, is id-based
  (managerId) and safe. `days` is client-supplied and trusted (not derived)
  except for Overtime. No accrual/balance math lives here — the frontend's
  `lib/leave-balances.ts` handles illustrative balances; province is stored
  but not enforced in this context.
- Frontend (`app/employee/leave/leave-view.tsx`) shows the "Team requests"
  approval card whenever the scoped list contains a non-own pending request,
  so managers of any role code (not just MANAGER) see their reports.
