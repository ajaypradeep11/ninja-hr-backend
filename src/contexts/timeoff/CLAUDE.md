# [TIMEOFF] Leave requests + department-manager approvals

## Why / design

Deliberately thin: no domain service layer — the routing rules ARE Prisma
`where` clauses in `infrastructure/timeoff.repository.ts`. The approval queue
belongs to the employee's *department manager* (not HR), with HR as override.

## Features

Leave request create/list/approve/deny/edit/cancel. Types: Vacation, Sick,
Personal, Parental, Bereavement, Overtime.

## Business rules (all in the repository)

- List scoping is the routing: HR = company-wide log; MANAGER = own requests
  + everything from their department (their approval queue); employee = own.
- Only the employee's department manager or HR may approve/deny.
- Edit tiers: HR edits anything incl. status; an employee edits only their
  OWN request while PENDING and never the status.
- Cancel: owner while Pending; HR anytime (hard delete).
- Overtime = extra hours worked on one date (1–12h, start==end, days forced
  to 1) — tracked, not deducted.
- Partial-day: single day, max 7h (8h = full day), start==end; `hours` null
  means full day(s). End date may not precede start.

## Gotchas

- Employee resolved by NAME (`findFirst({ name })`) — duplicate names collide
  silently. `days` is client-supplied and trusted (not derived) except for
  Overtime. No accrual/balance math lives here — the frontend's
  `lib/leave-balances.ts` handles illustrative balances; province is stored
  but not enforced in this context.
