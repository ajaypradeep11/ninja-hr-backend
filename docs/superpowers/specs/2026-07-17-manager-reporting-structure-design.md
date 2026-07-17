# Manager reporting structure — design

**Date:** 2026-07-17
**Status:** Approved, not yet implemented
**Scope:** Sub-project 1 of 2. Role-based access control is a separate design
that builds on this one.

## Problem

`Employee.manager` is a free-text name (`manager String?`), typed into a plain
text box on the employee record. Three things follow from that:

1. **It is used for access control.** Two places gate a manager's reach by
   comparing name strings:

   ```ts
   // workplace/infrastructure/letter-draft.service.ts:27
   // workplace/infrastructure/workplace.repository.ts:133
   if (!employee || (actor.role === 'MANAGER' && employee.manager !== actor.employeeName)) {
     throw new NotFoundException('Employee not found');
   }
   ```

   Two employees named "John Smith" and one manager reads the other's letters.
   Rename an employee and access silently breaks — or silently opens.

2. **There is no reverse side.** "Who reports to me" is a string match, so the
   product cannot answer it reliably and no UI offers it.

3. **Nothing constrains the input.** A typo, a nickname, or a departed employee's
   name all persist happily.

## Design

### Data model

```prisma
model Employee {
  // …
  managerId String?
  manager   Employee?  @relation("Reporting", fields: [managerId], references: [id], onDelete: SetNull)
  reportees Employee[] @relation("Reporting")

  @@index([managerId])
}
```

One manager per employee — a tree, matching how the app already reasons ("their
manager") and every current use. Dotted-line/matrix reporting is explicitly out
of scope: it would force every access check and org view to decide which manager
counts, for no demand today.

`onDelete: SetNull`: deleting a manager orphans their reportees rather than
cascading the delete through the org.

The free-text `manager` column is **dropped**. The name is derivable
(`row.manager?.name`), so `people.mapper` keeps exposing `manager` as a string
and downstream consumers — letter merge's `{{manager_name}}`, mass letters,
reports — need no change.

### Migration

1. Add `managerId` + FK + index.
2. Backfill: match `Employee.manager` (name) to an employee **in the same
   company**, and only where exactly one match exists. Ambiguous or unmatched
   names resolve to null — guessing wrong here would hand someone access to a
   stranger's record, which is the bug being fixed.
3. Drop the `manager` column.

Unmatched names are lost at step 3, so the rows are captured **before** the drop:
step 2 also copies every employee whose `manager` name did not resolve into a
one-off report (a `SELECT` run and saved alongside the pre-migration dump), so HR
has a list to re-link from the UI rather than discovering the gap by accident.

### Access control

The two name comparisons become identity comparisons:

```ts
- if (actor.role === 'MANAGER' && employee.manager !== actor.employeeName)
+ if (actor.role === 'MANAGER' && employee.managerId !== actor.employeeId)
```

This is the point of the exercise: it closes the duplicate-name hole and makes
the check survive renames.

### Validation (server-side, on every write)

- **Same company.** A cross-tenant `managerId` is a data-isolation breach. The
  picker only offers in-company people, but the API must not trust that.
- **No self-management.** `managerId !== id`.
- **No cycles.** Walk up the proposed chain before saving; reject A→B→A.
  Without this the org chart renders forever.

Each returns 400 with a specific message rather than a generic failure.

### API

- `PATCH /people/employees/:id` — takes `managerId` (nullable to unassign)
  instead of `manager`. Already exists; the DTO changes.
- `GET /people/employees/:id` — the detail read gains
  `reportees: { id, name, title }[]`, derived from the reverse relation.

### UI

- **Manager field** (Employment section) becomes a searchable picker over
  existing profiles, excluding self and own descendants so a cycle cannot be
  offered in the first place.
- **Direct reports** — a new section on the employee record, rendered whenever
  the person has reportees, each row linking to that profile. Not gated on the
  MANAGER role: HR admins and senior ICs have reports too, and gating would show
  them nothing.

### Testing

Unit:
- cycle / self-reference / cross-tenant guards
- mapper derives `manager` name from the relation

e2e:
- setting a manager surfaces the reportee on the reverse side
- a cross-tenant `managerId` is rejected
- **the regression that motivates this:** a manager reaches their reportee's
  letters, while a *same-named* manager from another company cannot. Written to
  fail against the current name-matching code.

## Out of scope

- Dotted-line / multiple managers.
- A dedicated org-chart page (the per-profile section covers the stated need).
- Role changes — see the RBAC design.

## Risks

- **The backfill is lossy by design.** Any `manager` name that is ambiguous or
  unmatched becomes null, and HR re-links it. Preferred over guessing, since a
  wrong link grants access.
- **Dropping `manager` is irreversible.** The name is recoverable from the
  relation for linked rows; unmatched names are lost. Take a dump first.
