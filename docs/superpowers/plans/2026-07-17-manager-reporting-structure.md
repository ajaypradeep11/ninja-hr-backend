# Manager Reporting Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the free-text `Employee.manager` name with a real relation to
`Employee`, so a manager's access is decided by identity instead of a name
string, and "who reports to me" becomes the reverse side of that relation.

**Architecture:** One nullable `managerId` FK on `Employee` pointing at another
`Employee` (a tree — one manager each), with `reportees` as the reverse side.
The `manager` name stays in the API contract but is *derived* from the relation
in the mapper, so letter merge, mass letters and reports need no change. Writes
validate same-company / no-self / no-cycle. The two name-comparison access
checks in `workplace` become id comparisons.

**Tech Stack:** NestJS + CQRS, Prisma 7 (Postgres), Jest (unit + supertest e2e),
Next.js 15 App Router frontend.

Spec: `docs/superpowers/specs/2026-07-17-manager-reporting-structure-design.md`

## Global Constraints

- Both repos: commit and push directly to `main` (per `CLAUDE.md`). No feature branches.
- Backend tests are colocated `*.spec.ts`; e2e lives in `test/*.e2e-spec.ts`.
- Never hand-edit an already-applied migration; add a new dated one.
- `npm run prisma:generate` after every schema change, or the client is stale.
- e2e requires a seeded local DB: `npm run db:up && DB_LIVE=false npx dotenv -e .env -- npx prisma migrate deploy && DB_LIVE=false npx dotenv -e .env -- npx prisma db seed`.
  **`.env` currently has `DB_LIVE=true` (live Supabase) — always pass `DB_LIVE=false` for tests.**
- Backend runs from a build: `rm -rf dist tsconfig.build.tsbuildinfo && npm run build`, then `node dist/main`.
- Temp scripts go in `scripts/` (excluded from `nest build`) or `$CLAUDE_JOB_DIR/tmp` — **never** the repo root; root `.ts` files get swept into the build and break `dist/main`.
- After backend API changes, regenerate the frontend client: `npm run api:generate` (backend must be running).

---

### Task 1: Add the `managerId` relation and backfill from names

**Files:**
- Modify: `prisma/schema.prisma` (model `Employee`, ~line 92 `manager String?`)
- Create: `prisma/migrations/20260717120000_employee_manager_relation/migration.sql`
- Create: `scripts/report-unmatched-managers.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Employee.managerId: string | null`, `Employee.manager?: Employee`,
  `Employee.reportees: Employee[]`. The `manager String?` column no longer exists.

- [ ] **Step 1: Capture the rows the backfill will drop, BEFORE migrating**

The migration drops `manager`; unmatched names are unrecoverable afterwards.
Create `scripts/report-unmatched-managers.ts`:

```ts
import '../src/platform/database/resolve-db-env';
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '../src/platform/database/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

(async () => {
  const rows = await p.$queryRawUnsafe<{ id: string; name: string; manager: string; companyId: string | null }[]>(
    `SELECT e."id", e."name", e."manager", e."companyId"
     FROM "Employee" e
     WHERE e."manager" IS NOT NULL
       AND (SELECT count(*) FROM "Employee" m
            WHERE m."name" = e."manager" AND m."companyId" IS NOT DISTINCT FROM e."companyId") <> 1`,
  );
  const path = `backups/unmatched-managers-${process.argv[2]}.json`;
  writeFileSync(path, JSON.stringify(rows, null, 2));
  console.log(`${rows.length} employee(s) whose manager name will NOT link → ${path}`);
  await p.$disconnect();
})();
```

- [ ] **Step 2: Run it against the live DB and keep the output**

Run (from `ninja-hr-backend/`):
```bash
mkdir -p backups
npx dotenv -e .env -- npx tsx scripts/report-unmatched-managers.ts $(date +%Y%m%d-%H%M%S)
```
Expected: `N employee(s) whose manager name will NOT link → backups/unmatched-managers-….json`.
`backups/` is already gitignored. Delete the script afterwards (`rm scripts/report-unmatched-managers.ts`) — it is one-shot.

- [ ] **Step 3: Edit the schema**

In `prisma/schema.prisma`, model `Employee`, replace `  manager             String?` with:

```prisma
  /// Who this person reports to. A relation, not a name: the name was used for
  /// access checks, so duplicates leaked and renames silently re-pointed them.
  managerId           String?
  manager             Employee?             @relation("Reporting", fields: [managerId], references: [id], onDelete: SetNull)
  reportees           Employee[]            @relation("Reporting")
```

And add to the same model's index block (next to `@@index([companyId])`):

```prisma
  @@index([managerId])
```

- [ ] **Step 4: Write the migration**

Create `prisma/migrations/20260717120000_employee_manager_relation/migration.sql`:

```sql
-- `manager` was a free-text name that two access checks compared against the
-- actor's name — duplicates leaked and renames re-pointed access. Replace it
-- with a real link.
ALTER TABLE "Employee" ADD COLUMN "managerId" TEXT;

CREATE INDEX "Employee_managerId_idx" ON "Employee"("managerId");

ALTER TABLE "Employee"
  ADD CONSTRAINT "Employee_managerId_fkey"
  FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill only where the name resolves to EXACTLY ONE employee in the SAME
-- company. Ambiguous or unmatched names stay null: a wrong link would hand
-- someone access to a stranger's record, which is the bug being fixed.
UPDATE "Employee" e
SET "managerId" = m."id"
FROM "Employee" m
WHERE m."name" = e."manager"
  AND m."companyId" IS NOT DISTINCT FROM e."companyId"
  AND m."id" <> e."id"
  AND (SELECT count(*) FROM "Employee" m2
       WHERE m2."name" = e."manager" AND m2."companyId" IS NOT DISTINCT FROM e."companyId") = 1;

-- A cycle would make the org chart render forever; none should exist, but a
-- self-link is trivially possible from the old free text.
UPDATE "Employee" SET "managerId" = NULL WHERE "managerId" = "id";

ALTER TABLE "Employee" DROP COLUMN "manager";
```

- [ ] **Step 5: Apply to the LOCAL db and regenerate the client**

Run:
```bash
npm run db:up
DB_LIVE=false npx dotenv -e .env -- npx prisma migrate deploy
npm run prisma:generate
```
Expected: `All migrations have been successfully applied.` then `Generated Prisma Client`.

- [ ] **Step 6: Confirm the column is gone and the FK exists**

Run:
```bash
cat > scripts/tmp-check.ts <<'EOF'
import '../src/platform/database/resolve-db-env';
import { PrismaClient } from '../src/platform/database/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
(async () => {
  const cols = await p.$queryRawUnsafe<{ column_name: string }[]>(
    `SELECT column_name FROM information_schema.columns WHERE table_name='Employee' AND column_name IN ('manager','managerId')`);
  console.log(cols.map((c) => c.column_name));
  await p.$disconnect();
})();
EOF
DB_LIVE=false npx dotenv -e .env -- npx tsx scripts/tmp-check.ts
rm scripts/tmp-check.ts
```
Expected: `[ 'managerId' ]` — `manager` absent.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260717120000_employee_manager_relation
git commit -m "feat(people): Employee.manager becomes a relation, not a name

The name was load-bearing for access control (two checks compared it to the
actor's name), so duplicates leaked and a rename silently re-pointed access.
Backfills only unambiguous same-company matches; anything else stays null for
HR to re-link, because a wrong link grants access."
git push origin main
```

---

### Task 2: Derive the manager name in the mapper

**Files:**
- Modify: `src/contexts/people/infrastructure/people.mapper.ts:62`
- Modify: `src/contexts/people/infrastructure/people.repository.ts:60-71` (`getEmployeeDetail`)
- Test: `src/contexts/people/infrastructure/people.mapper.spec.ts`

**Interfaces:**
- Consumes: `Employee.managerId`, `Employee.manager` relation (Task 1).
- Produces: `rowToEmployee(row)` / `rowToEmployeeDetail(row)` keep emitting
  `manager?: string` (the NAME) — now read from `row.manager?.name` — plus
  `managerId?: string`. Existing consumers (`letter-merge`, mass letters,
  reports) are unchanged.

- [ ] **Step 1: Write the failing test**

Append to `src/contexts/people/infrastructure/people.mapper.spec.ts`:

```ts
describe('manager, derived from the relation', () => {
  const base = {
    id: 'e1', name: 'Ada Lovelace', title: 'Engineer', department: 'Engineering',
    province: 'ON', email: 'ada@example.com', hireDate: new Date('2020-01-01'),
    birthDate: new Date('1990-01-01'), birthdayPrivate: false, status: 'ACTIVE',
    salary: 100000, employeeNumber: 'EMP-0001',
  };

  it('emits the manager NAME from the joined row, so consumers are unchanged', () => {
    const out = rowToEmployee({ ...base, managerId: 'm1', manager: { id: 'm1', name: 'Grace Hopper' } } as never);
    expect(out.manager).toBe('Grace Hopper');
    expect(out.managerId).toBe('m1');
  });

  it('leaves both undefined when nobody is assigned', () => {
    const out = rowToEmployee({ ...base, managerId: null, manager: null } as never);
    expect(out.manager).toBeUndefined();
    expect(out.managerId).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/contexts/people/infrastructure/people.mapper.spec.ts -t 'derived from the relation'`
Expected: FAIL — `expect(received).toBe('Grace Hopper')` receives `undefined`
(the mapper still reads the dropped `row.manager` string).

- [ ] **Step 3: Update the mapper**

In `src/contexts/people/infrastructure/people.mapper.ts`, replace line 62
(`    manager: row.manager ?? undefined,`) with:

```ts
    // The NAME, derived from the joined relation — `manager` is no longer a
    // column. Keeps every consumer ({{manager_name}}, mass letters, reports)
    // working off the same contract while the link itself is by id.
    manager: row.manager?.name ?? undefined,
    managerId: row.managerId ?? undefined,
```

Apply the identical two lines wherever `rowToEmployeeDetail` maps `manager` in
the same file (search `manager:` — there is one occurrence per mapper).

- [ ] **Step 4: Join the relation on reads**

In `src/contexts/people/infrastructure/people.repository.ts`, `getEmployeeDetail`
(line ~61), add to the `include`:

```ts
        manager: { select: { id: true, name: true } },
        reportees: { select: { id: true, name: true, title: true }, orderBy: { name: 'asc' } },
```

And in `getEmployees` (line ~37), change the `findMany` to:

```ts
    const rows = await this.prisma.employee.findMany({
      where: { status: { not: 'PRE_HIRE' } },
      orderBy: { name: 'asc' },
      include: { manager: { select: { id: true, name: true } } },
    });
```

- [ ] **Step 5: Add the types**

In `src/contexts/people/domain/people.types.ts`, next to each existing
`manager?: string;` (lines ~24, ~92, ~103) add:

```ts
  managerId?: string;
```

And on the `EmployeeDetail` interface (the one at ~line 92 with documents /
emergencyContacts) add:

```ts
  /** Direct reports — the reverse side of the manager relation. */
  reportees?: { id: string; name: string; title: string }[];
```

Map it in `rowToEmployeeDetail`:

```ts
    reportees: row.reportees ?? [],
```

- [ ] **Step 6: Run the tests**

Run: `npx jest src/contexts/people`
Expected: PASS, including the two new cases.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add src/contexts/people
git commit -m "feat(people): derive the manager name from the relation; expose reportees"
git push origin main
```

---

### Task 3: Validate manager writes (same company, no self, no cycles)

**Files:**
- Create: `src/contexts/people/domain/reporting.ts`
- Create: `src/contexts/people/domain/reporting.spec.ts`
- Modify: `src/contexts/people/interface/dto/people.dto.ts:41,52`
- Modify: `src/contexts/people/infrastructure/people.repository.ts` (`updateEmployee`)

**Interfaces:**
- Consumes: `managerId` from Task 1.
- Produces: `assertNoCycle(chain: string[], employeeId: string): void` from
  `src/contexts/people/domain/reporting.ts`, throwing `BadRequestException`.
  `UpdateEmployeeDto.managerId?: string | null` replaces `manager?: string`.

- [ ] **Step 1: Write the failing test**

Create `src/contexts/people/domain/reporting.spec.ts`:

```ts
import { BadRequestException } from '@nestjs/common';
import { assertNoCycle } from './reporting';

describe('assertNoCycle', () => {
  it('accepts a chain that does not lead back to the employee', () => {
    expect(() => assertNoCycle(['m1', 'm2'], 'e1')).not.toThrow();
  });

  it('rejects a chain that loops back — the org chart would never terminate', () => {
    expect(() => assertNoCycle(['m1', 'e1'], 'e1')).toThrow(BadRequestException);
  });

  it('rejects managing yourself', () => {
    expect(() => assertNoCycle(['e1'], 'e1')).toThrow(BadRequestException);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/contexts/people/domain/reporting.spec.ts`
Expected: FAIL — `Cannot find module './reporting'`.

- [ ] **Step 3: Write the domain rule**

Create `src/contexts/people/domain/reporting.ts`:

```ts
import { BadRequestException } from '@nestjs/common';

/**
 * Reject a reporting line that leads back to the employee. Cycles are not a
 * theoretical worry: the org section walks `manager` upward, so A→B→A renders
 * forever. Pure, so the walk itself stays in the repository.
 *
 * @param chain manager ids from the proposed manager upward, nearest first
 * @param employeeId the employee being edited
 */
export function assertNoCycle(chain: string[], employeeId: string): void {
  if (chain.includes(employeeId)) {
    throw new BadRequestException('That reporting line loops back to this employee.');
  }
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx jest src/contexts/people/domain/reporting.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Swap the DTO field**

In `src/contexts/people/interface/dto/people.dto.ts`, replace BOTH occurrences
(lines ~41 and ~52) of:

```ts
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(120) manager?: string;
```

with:

```ts
  /** Who they report to, by id. `null` unassigns. Validated server-side for
   *  same-company / no-self / no-cycle — the picker cannot be trusted. */
  @ApiProperty({ required: false, nullable: true })
  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsString() @MaxLength(40)
  managerId?: string | null;
```

Add `ValidateIf` to the `class-validator` import at the top of the file.

- [ ] **Step 6: Enforce it on write**

In `src/contexts/people/infrastructure/people.repository.ts`, add this private
method to `PeopleRepository`:

```ts
  /**
   * Resolve a proposed manager, or throw. The picker only offers in-company
   * people, but the API must not trust that: a cross-tenant managerId is a
   * data-isolation breach.
   */
  private async assertManagerAssignable(employeeId: string, managerId: string): Promise<void> {
    if (managerId === employeeId) {
      throw new BadRequestException('An employee cannot report to themselves.');
    }
    // Tenant-scoped client: another company's employee simply is not found.
    const manager = await this.prisma.employee.findUnique({
      where: { id: managerId },
      select: { id: true, managerId: true },
    });
    if (!manager) throw new BadRequestException('That manager is not an employee of this company.');

    // Walk upward collecting the proposed chain, then let the domain rule judge.
    const chain: string[] = [];
    let cursor: string | null = manager.managerId;
    while (cursor && !chain.includes(cursor)) {
      chain.push(cursor);
      const next: { managerId: string | null } | null = await this.prisma.employee.findUnique({
        where: { id: cursor },
        select: { managerId: true },
      });
      cursor = next?.managerId ?? null;
    }
    assertNoCycle([managerId, ...chain], employeeId);
  }
```

Import at the top of the file:

```ts
import { assertNoCycle } from '../domain/reporting';
```

and add `BadRequestException` to the existing `@nestjs/common` import.

Then, inside `updateEmployee`, before the `prisma.employee.update` call, add:

```ts
    if (input.managerId) await this.assertManagerAssignable(id, input.managerId);
```

- [ ] **Step 7: Run the people tests + typecheck**

Run: `npx jest src/contexts/people && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/contexts/people
git commit -m "feat(people): validate manager writes — same company, no self, no cycles"
git push origin main
```

---

### Task 4: Decide manager access by identity, not by name

**Files:**
- Modify: `src/contexts/workplace/infrastructure/letter-draft.service.ts:27`
- Modify: `src/contexts/workplace/infrastructure/workplace.repository.ts:133`
- Modify: `src/contexts/workplace/infrastructure/letter-draft.service.ts:10` and
  `src/contexts/workplace/infrastructure/mass-letter.service.ts:8` (the `SELECT` maps)
- Test: `test/tenant-isolation.e2e-spec.ts`

**Interfaces:**
- Consumes: `Employee.managerId` (Task 1), `ActorContext.employeeId` (existing).
- Produces: no new API.

- [ ] **Step 1: Write the failing e2e**

Append inside the `describe('Tenant isolation (e2e)')` block in
`test/tenant-isolation.e2e-spec.ts`:

```ts
  /**
   * Manager reach used to be decided by comparing NAMES
   * (`employee.manager !== actor.employeeName`), so a manager could read the
   * record of an identically-named person's reportee — in another company.
   */
  it('a same-named manager in another company cannot reach this one’s reportee', async () => {
    const sameName = 'Pat Taylor';
    // Company A: manager + their reportee.
    const mgrA = await prisma.employee.create({
      data: {
        companyId: SEED_COMPANY_ID, name: sameName, title: 'Manager', department: 'Engineering',
        province: 'ON', email: `pat-a-${suffix}@test.com`, hireDate: new Date('2021-01-01'),
        birthDate: new Date('1985-01-01'), salary: 90000,
      },
    });
    const reportA = await prisma.employee.create({
      data: {
        companyId: SEED_COMPANY_ID, name: 'Reportee A', title: 'Engineer', department: 'Engineering',
        province: 'ON', email: `rep-a-${suffix}@test.com`, hireDate: new Date('2022-01-01'),
        birthDate: new Date('1990-01-01'), salary: 80000, managerId: mgrA.id,
      },
    });
    // Company B: a DIFFERENT person with the same name, managing nobody here.
    const mgrB = await prisma.employee.create({
      data: {
        companyId: companyBId, name: sameName, title: 'Manager', department: 'Engineering',
        province: 'ON', email: `pat-b-${suffix}@test.com`, hireDate: new Date('2021-01-01'),
        birthDate: new Date('1985-01-01'), salary: 90000,
      },
    });
    const userB = await prisma.user.create({
      data: { companyId: companyBId, employeeId: mgrB.id, role: 'MANAGER' },
    });

    await request(app.getHttpServer())
      .get(`/api/v1/people/employees/${reportA.id}`)
      .set(as(userB.id))
      .expect(404);
  });
```

- [ ] **Step 2: Run it and watch it fail**

Run:
```bash
DB_LIVE=false npx dotenv -e .env -- npx jest --config ./test/jest-e2e.json --runInBand --testPathPattern 'tenant-isolation' -t 'same-named manager'
```
Expected: FAIL if any name-based check still governs the read. If it passes
immediately, the tenant extension already blocks it — keep the test (it pins the
guarantee) and note that in the commit.

- [ ] **Step 3: Replace the name comparisons**

`src/contexts/workplace/infrastructure/letter-draft.service.ts` line ~27:

```ts
    if (!employee || (actor.role === 'MANAGER' && employee.managerId !== actor.employeeId)) {
      throw new NotFoundException('Employee not found');
    }
```

`src/contexts/workplace/infrastructure/workplace.repository.ts` line ~133:

```ts
    if (!emp || (actor?.role === 'MANAGER' && emp.managerId !== actor.employeeId)) {
      throw new NotFoundException('Employee not found');
    }
```

- [ ] **Step 4: Fix the SELECT maps that still ask for `manager`**

In `letter-draft.service.ts` (~line 10) and `mass-letter.service.ts` (~line 8),
the `SELECT`/`EMPLOYEE_SELECT` objects list `manager: true` — that column is
gone. Replace `manager: true,` in each with:

```ts
  managerId: true,
  manager: { select: { name: true } },
```

Then, where the letter payload is built (`letter-draft.service.ts` ~line 46 and
the equivalent in `mass-letter.service.ts`), change `manager: employee.manager,`
to:

```ts
      manager: employee.manager?.name ?? null,
```

`letter-merge.ts`'s `{{manager_name}}` reads `employee.manager ?? 'your manager'`
and its type (`workplace.types.ts:139`) is `manager: string | null` — both stay
as they are.

- [ ] **Step 5: Run the e2e and the unit suite**

Run:
```bash
DB_LIVE=false npx dotenv -e .env -- npx jest --config ./test/jest-e2e.json --runInBand --testPathPattern 'tenant-isolation'
npx jest
npx tsc --noEmit
```
Expected: e2e all PASS (including the new case), unit suite all PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/contexts/workplace test/tenant-isolation.e2e-spec.ts
git commit -m "fix(workplace): decide manager access by id, not by name

Two checks compared employee.manager (free text) to the actor's NAME, so an
identically-named manager matched, and renaming re-pointed access."
git push origin main
```

---

### Task 5: Manager picker + Direct reports section

**Files:**
- Modify: `components/employees/employee-record.tsx:101` (draft), `:361` (the Manager input)
- Modify: `lib/data.ts` (the `Employee` / `EmployeeDetail` interfaces)
- Modify: `lib/api/generated/openapi.d.ts` (regenerated, not hand-edited)

**Interfaces:**
- Consumes: `managerId`, `manager` (name), `reportees[]` from Tasks 2-3.
- Produces: no new module.

- [ ] **Step 1: Regenerate the API types**

With the backend running (`node dist/main` after a rebuild), from `ninja-hr-frontend/`:
```bash
npm run api:generate
```
Expected: `http://localhost:4000/api/docs-json → lib/api/generated/openapi.d.ts`.

- [ ] **Step 2: Add the frontend types**

In `lib/data.ts`, on the `Employee` interface (next to `manager?: string;`) add:

```ts
  managerId?: string;
```

and on `EmployeeDetail`:

```ts
  /** Direct reports — the reverse side of the manager relation. */
  reportees?: { id: string; name: string; title: string }[];
```

- [ ] **Step 3: Turn the Manager text box into a picker**

`components/employees/employee-record.tsx` line ~361 currently reads
`{input("manager", "Manager")}`. Replace it with:

```tsx
            <div>
              <label className="field-label">Manager</label>
              <select
                className="field-input"
                value={draft.managerId ?? emp.managerId ?? ""}
                onChange={(e) => setDraft({ ...draft, managerId: e.target.value || null })}
              >
                <option value="">— No manager —</option>
                {managerOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {m.title}
                  </option>
                ))}
              </select>
            </div>
```

Above the return, derive the options — excluding self, so the obvious cycle is
not even offerable:

```tsx
  // Existing profiles only: a free-text manager name was what let duplicates
  // and typos through. Self is excluded so the simplest cycle can't be picked.
  const managerOptions = React.useMemo(
    () => directory.filter((d) => d.id !== emp.id),
    [directory, emp.id],
  );
```

`directory` comes from the same `listEmployeeDirectory()` action the onboarding
Assign picker uses (`app/actions/onboarding.ts:190`); load it in an effect exactly
as `app/admin/onboarding/[id]/page.tsx:103-107` does.

**First, stop that action throwing the id away.** It already fetches
`GET /api/v1/people/employees`, which returns `id` — the action's own `.map()`
drops it (`ninja-hr-frontend/app/actions/onboarding.ts:190-197`). No backend
change is needed. Widen it:

```ts
export async function listEmployeeDirectory(): Promise<
  { id: string; name: string; department: string; title: string }[]
> {
  const rows = await unwrap<{ id: string; name: string; department: string; title: string }[]>(
    (await api()).GET("/api/v1/people/employees"),
  );
  return (rows ?? []).map((e) => ({ id: e.id, name: e.name, department: e.department, title: e.title }));
}
```

The onboarding Assign picker consumes this too; it matches on `name`, so adding
a field is additive and leaves it working.

- [ ] **Step 4: Send `managerId`, not `manager`**

At line ~101 the draft seeds `manager: emp.manager`. Change it to:

```ts
        managerId: emp.managerId,
```

Check the save handler passes `managerId` through to the update action; the DTO
no longer accepts `manager`.

- [ ] **Step 5: Add the Direct reports section**

After the Emergency Contacts card in the Details tab, add:

```tsx
      {!!emp.reportees?.length && (
        <Card className="card-pad mt-6">
          <h3 className="text-base font-bold text-ink">Direct reports</h3>
          <p className="mt-1 text-sm text-ink-muted">
            {emp.reportees.length} {emp.reportees.length === 1 ? "person reports" : "people report"} to {emp.name}.
          </p>
          <div className="mt-3 space-y-2">
            {emp.reportees.map((r) => (
              <Link
                key={r.id}
                href={`/admin/employees/${r.id}`}
                className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-2.5 hover:bg-canvas"
              >
                <Avatar name={r.name} size={28} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">{r.name}</span>
                  <span className="block truncate text-xs text-ink-muted">{r.title}</span>
                </span>
              </Link>
            ))}
          </div>
        </Card>
      )}
```

Rendered whenever the person has reports — deliberately not gated on the MANAGER
role, since HR admins and senior ICs have reports too. Ensure `Link` and `Avatar`
are imported in this file.

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no type errors; `0 errors` from eslint (warnings are pre-existing).

- [ ] **Step 7: Verify in a browser**

Sign in as HR, open an employee, set a manager from the dropdown, save, then open
that manager's profile and confirm the employee appears under Direct reports and
links through. Confirm the picker has no free-text entry and cannot select the
employee themselves.

- [ ] **Step 8: Commit**

```bash
git add components/employees/employee-record.tsx lib/data.ts lib/api/generated/openapi.d.ts
git commit -m "feat(employees): pick a manager from existing profiles; show direct reports"
git push origin main
```

---

### Task 6: Apply the migration to the live database

**Files:** none (operational).

**Interfaces:**
- Consumes: the migration from Task 1.

- [ ] **Step 1: Back up live first**

The migration drops a column. Take the JSON dump (`backups/` is gitignored) as
in the earlier session, then keep it until the feature is confirmed working.

- [ ] **Step 2: Apply**

Run: `npm run prisma:migrate`
Expected: `20260717120000_employee_manager_relation` applied,
`All migrations have been successfully applied.`
**This may be blocked by the auto-mode classifier — if so, ask the user to run it
via `! npm run prisma:migrate`.**

- [ ] **Step 3: Confirm the backfill**

Compare against `backups/unmatched-managers-*.json` from Task 1 Step 2: every
employee listed there should now have `managerId = null` and need a re-link;
everyone else should be linked. Report the count to the user.

- [ ] **Step 4: Report**

Tell the user how many employees need their manager re-linked by hand, and where
the list is.

---

## Self-review

**Spec coverage:**
- Data model (relation, one manager, SetNull) → Task 1
- Migration + same-company/one-match backfill + drop → Task 1
- Unmatched-name capture → Task 1 Steps 1-2, reported in Task 6
- Access control by id → Task 4
- Validation (same company / no self / no cycle) → Task 3
- API (`managerId` on PATCH, `reportees` on detail) → Tasks 2-3
- UI (picker excluding self, Direct reports section) → Task 5
- Testing (unit: cycle/self/mapper; e2e: reportees, cross-tenant, same-name) → Tasks 2-4
- Live migration → Task 6

**Type consistency:** `managerId?: string` (domain), `managerId?: string | null`
(DTO — null unassigns), `manager?: string` (the NAME, derived), `reportees?: {
id; name; title }[]`. `assertNoCycle(chain, employeeId)` is named identically in
Tasks 3's definition and use.

**Assumptions verified before publishing this plan:**
- `src/contexts/people/infrastructure/people.mapper.spec.ts` exists — Task 2
  appends to it rather than creating it.
- `listEmployeeDirectory()` already fetches `GET /people/employees` (which
  returns `id`) and discards the id in its own `.map()`. Task 5 Step 3 widens
  the action; **no backend change is required**, contrary to a first reading.
