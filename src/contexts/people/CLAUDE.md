# [PEOPLE] HRIS — employees, org structure, comp benchmarks

## Why / design

The system of record for employee data, so its rules are about who can see
and edit which FIELDS, not who can call which route. `manager` is exposed as
a name (template back-compat: `{{manager_name}}`) while stored as
`managerId`; the cycle check is a pure domain function
(`domain/reporting.ts`) kept framework-free.

## Features

Directory + by-name lookup · full HRIS detail · manual create (HR) · update ·
emergency contacts · headcount-by-dept · salary benchmarks (HR-only).

## Business rules

- Field-level authz: non-HR self-service edits only `SELF_EDITABLE`
  (preferredName, pronouns, personalEmail, phone, address*, birthdayPrivate);
  anything else → Forbidden listing the blocked fields. `assertSelfOrHr`
  gates detail/update/contacts.
- SIN/bank are ALWAYS masked (last-3 / last-4); raw values never leave the
  backend; `hasSin`/`hasBanking` flag presence. Roster payload carries no
  sin/bank keys at all (spec-asserted). Non-HR viewers get `salary: 0` and
  birthDate cleared when `birthdayPrivate`.
- Directory excludes `PRE_HIRE`; detail/by-name don't (a pre-hire can load
  their own profile). Headcount counts ACTIVE + ON_STATUTORY_LEAVE only.
- Manager writes: no self-reporting, manager must exist in-tenant (foreign id
  resolves to not-found via the scoped client), and `assertNoCycle` walks the
  chain upward. hireDate may not precede birthDate. Duplicate email →
  Conflict (P2002 global-unique). `employeeNumber` = next `EMP-NNNN`.

## Gotchas

- Update semantics: `undefined` = untouched, empty/`null` = clear — per-field
  `has()` guards; easy to break when adding fields.
- `getEmployeeByName` returns an arbitrary first match on duplicate names.
- Controller casts DTOs `as any` into commands — DTO validation is the only
  shape guard.
