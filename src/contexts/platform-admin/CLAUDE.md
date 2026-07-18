# [PLATFORM-ADMIN] Cross-tenant admin console (two-key)

## Why / design

The only context that is cross-tenant BY DESIGN: its repository injects the
raw `PrismaService` (the tenant extension would forbid every query here).
That makes the class privileged — `PlatformAdminGuard` (`x-platform-admin-key`,
a second secret on top of the internal key, constant-time, fails closed when
unset) is the only thing keeping it reachable. Routes carry no `x-actor-id`,
so the tenant stays unset — correct, since the repo is unscoped.

## Features

Overview metrics · company list + per-company users · merged log feed ·
create/delete company · delete user.

## Business rules

- Delete company CASCADES to every owned row — irreversible, guard-gated
  only. Delete user removes the login only; the Employee record stays.
- `activeCompanies` = companies with ≥1 user (userless = non-loginable
  shell). `failures` = ModerationEvents in last 24h.
- Log severity is DERIVED (moderation → warning, audit → info); there is
  deliberately no `error` case — no schema table records failures, so the
  Errors bar honestly reads zero. AgentRun is excluded as a log source (its
  `time` is free text, unsortable).

## Gotchas

- Merged feed: each source capped at `limit`, merged, re-sorted, re-capped —
  that union is what guarantees the newest `limit` overall.
- `createCompany` slug dedupe is read-then-write; concurrent create surfaces
  as ConflictException via the unique constraint.
