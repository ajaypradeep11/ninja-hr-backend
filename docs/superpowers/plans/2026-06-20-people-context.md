# People Bounded Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only People bounded context in NestJS that exposes four REST endpoints returning Employee and SalaryBenchmark data from Prisma, matching the exact DTO shapes the frontend expects.

**Architecture:** Follows the existing Onboarding context pattern: domain types → mapper (enum conversions + rowTo*) → repository (PrismaService) → CQRS query/handlers → controller. No commands; all four operations are queries. The mapper handles the DB enum ↔ display-string conversion for EmployeeStatus.

**Tech Stack:** NestJS 11, @nestjs/cqrs, PrismaService (injected), TypeScript strict mode, Jest + ts-jest, `src/...` path alias.

## Global Constraints

- All imports use `src/...` alias (not relative `../../`), matching the onboarding context pattern.
- DTO field names and EmployeeStatus string literals are **frozen** — must match `lib/data.ts` exactly (e.g. `"On Statutory Leave"` not `"ON_STATUTORY_LEAVE"`).
- empStatus enum map must match `lib/db-map.ts` exactly (`empStatusToDb` / `empStatusFromDb`).
- Dates sliced to 10 chars (ISO date only, `YYYY-MM-DD`) — same `iso()` helper as frontend.
- No commands; People is reads-only.
- `npm run build` must exit 0; `npm test` must pass; `npm run lint` must exit 0.
- Commit message must end with trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Global API prefix: `api/v1`; people routes under `people` controller prefix.
- Auth: existing guards on app (x-internal-key / x-actor-persona headers) apply globally — no change needed in this module.

---

## File Map

| Path | Responsibility |
|------|----------------|
| `src/contexts/people/domain/people.types.ts` | EmployeeStatus type, Employee interface, SalaryBenchmark interface |
| `src/contexts/people/infrastructure/people.mapper.ts` | empStatusToDb, empStatusFromDb (invert), rowToEmployee |
| `src/contexts/people/infrastructure/people.mapper.spec.ts` | Unit test: empStatus round-trip |
| `src/contexts/people/infrastructure/people.repository.ts` | PeopleRepository: getEmployees, getEmployeeByName, headcountByDept, salaryBenchmarks |
| `src/contexts/people/application/queries/get-employees.query.ts` | GetEmployeesQuery + GetEmployeesHandler |
| `src/contexts/people/application/queries/get-employee-by-name.query.ts` | GetEmployeeByNameQuery + GetEmployeeByNameHandler |
| `src/contexts/people/application/queries/get-headcount.query.ts` | GetHeadcountQuery + GetHeadcountHandler |
| `src/contexts/people/application/queries/get-salary-benchmarks.query.ts` | GetSalaryBenchmarksQuery + GetSalaryBenchmarksHandler |
| `src/contexts/people/interface/people.controller.ts` | PeopleController: 4 GET routes under 'people' |
| `src/contexts/people/people.module.ts` | PeopleModule: CqrsModule, repo + 4 handlers + controller |
| `src/app.module.ts` | Register PeopleModule |

---

### Task 1: Domain Types

**Files:**
- Create: `src/contexts/people/domain/people.types.ts`

**Interfaces:**
- Produces: `EmployeeStatus` (union type), `Employee` (interface), `SalaryBenchmark` (interface) — all used by mapper and repository.

- [ ] **Step 1: Create domain types file**

```typescript
// src/contexts/people/domain/people.types.ts
import type { ProvinceCode } from 'src/shared-kernel/province';

export type EmployeeStatus =
  | 'Active'
  | 'Pre-Hire'
  | 'On Statutory Leave'
  | 'Offboarding'
  | 'Terminated';

export interface Employee {
  id: string;
  name: string;
  title: string;
  department: string;
  province: ProvinceCode;
  email: string;
  hireDate: string;   // ISO date YYYY-MM-DD
  birthDate: string;  // ISO date YYYY-MM-DD
  manager?: string;
  status: EmployeeStatus;
  salary: number;
  avatar?: string;
}

export interface SalaryBenchmark {
  role: string;
  low: number;
  high: number;
  current: number;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/ajaypradeepm/Work/NinjaHR\ project/ninja-hr-backend && npx tsc --noEmit 2>&1 | grep people`
Expected: no output (no errors in the new file; other pre-existing errors are irrelevant here — run `npm run build` at the end instead).

---

### Task 2: Mapper + Unit Test

**Files:**
- Create: `src/contexts/people/infrastructure/people.mapper.ts`
- Create: `src/contexts/people/infrastructure/people.mapper.spec.ts`

**Interfaces:**
- Consumes: `EmployeeStatus`, `Employee` from `src/contexts/people/domain/people.types`; `ProvinceCode` from `src/shared-kernel/province`.
- Produces: `empStatusToDb`, `empStatusFromDb`, `rowToEmployee(row: any): Employee` — all used by the repository.

- [ ] **Step 1: Write the failing test**

Create `src/contexts/people/infrastructure/people.mapper.spec.ts`:

```typescript
// src/contexts/people/infrastructure/people.mapper.spec.ts
import { empStatusToDb, empStatusFromDb } from './people.mapper';

describe('people enum maps', () => {
  it('round-trips On Statutory Leave', () => {
    expect(empStatusToDb['On Statutory Leave']).toBe('ON_STATUTORY_LEAVE');
    expect(empStatusFromDb['ON_STATUTORY_LEAVE']).toBe('On Statutory Leave');
  });

  it('round-trips Pre-Hire', () => {
    expect(empStatusToDb['Pre-Hire']).toBe('PRE_HIRE');
    expect(empStatusFromDb['PRE_HIRE']).toBe('Pre-Hire');
  });

  it('round-trips all five statuses', () => {
    const statuses = ['Active', 'Pre-Hire', 'On Statutory Leave', 'Offboarding', 'Terminated'] as const;
    for (const s of statuses) {
      const db = empStatusToDb[s];
      expect(empStatusFromDb[db]).toBe(s);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/ajaypradeepm/Work/NinjaHR\ project/ninja-hr-backend && npx jest src/contexts/people/infrastructure/people.mapper.spec.ts --no-coverage 2>&1 | tail -20`
Expected: FAIL — "Cannot find module './people.mapper'"

- [ ] **Step 3: Create the mapper**

Create `src/contexts/people/infrastructure/people.mapper.ts`:

```typescript
// src/contexts/people/infrastructure/people.mapper.ts
import type { ProvinceCode } from 'src/shared-kernel/province';
import type { Employee, EmployeeStatus } from '../domain/people.types';

function invert<K extends string, V extends string>(m: Record<K, V>): Record<V, K> {
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k])) as Record<V, K>;
}

export const empStatusToDb = {
  Active: 'ACTIVE',
  'Pre-Hire': 'PRE_HIRE',
  'On Statutory Leave': 'ON_STATUTORY_LEAVE',
  Offboarding: 'OFFBOARDING',
  Terminated: 'TERMINATED',
} satisfies Record<EmployeeStatus, string>;

export const empStatusFromDb = invert(empStatusToDb);

const iso = (d: Date): string => d.toISOString().slice(0, 10);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToEmployee(row: any): Employee {
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    department: row.department,
    province: row.province as ProvinceCode,
    email: row.email,
    hireDate: iso(row.hireDate),
    birthDate: iso(row.birthDate),
    manager: row.manager ?? undefined,
    status: empStatusFromDb[row.status as keyof typeof empStatusFromDb],
    salary: row.salary,
    avatar: row.avatar ?? undefined,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/ajaypradeepm/Work/NinjaHR\ project/ninja-hr-backend && npx jest src/contexts/people/infrastructure/people.mapper.spec.ts --no-coverage 2>&1 | tail -20`
Expected: PASS — 3 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/ajaypradeepm/Work/NinjaHR\ project/ninja-hr-backend
git add src/contexts/people/domain/people.types.ts \
        src/contexts/people/infrastructure/people.mapper.ts \
        src/contexts/people/infrastructure/people.mapper.spec.ts
git commit -m "$(cat <<'EOF'
feat(people): add domain types and empStatus mapper with tests

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Repository

**Files:**
- Create: `src/contexts/people/infrastructure/people.repository.ts`

**Interfaces:**
- Consumes: `PrismaService` from `src/platform/database/prisma.service`; `rowToEmployee` from `./people.mapper`; `Employee`, `SalaryBenchmark` from `../domain/people.types`.
- Produces: `PeopleRepository` class (Injectable) with methods:
  - `getEmployees(): Promise<Employee[]>`
  - `getEmployeeByName(name: string): Promise<Employee | null>`
  - `headcountByDept(): Promise<{ dept: string; count: number }[]>`
  - `salaryBenchmarks(): Promise<SalaryBenchmark[]>`

- [ ] **Step 1: Create the repository**

Create `src/contexts/people/infrastructure/people.repository.ts`:

```typescript
// src/contexts/people/infrastructure/people.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/platform/database/prisma.service';
import type { Employee, SalaryBenchmark } from '../domain/people.types';
import { rowToEmployee } from './people.mapper';

@Injectable()
export class PeopleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getEmployees(): Promise<Employee[]> {
    const rows = await this.prisma.employee.findMany({ orderBy: { name: 'asc' } });
    return rows.map(rowToEmployee);
  }

  async getEmployeeByName(name: string): Promise<Employee | null> {
    const rows = await this.prisma.employee.findMany({ where: { name }, take: 1 });
    return rows.length ? rowToEmployee(rows[0]) : null;
  }

  async headcountByDept(): Promise<{ dept: string; count: number }[]> {
    const grouped = await this.prisma.employee.groupBy({
      by: ['department'],
      _count: { _all: true },
    });
    return grouped
      .map((g) => ({ dept: g.department, count: g._count._all }))
      .sort((a, b) => b.count - a.count);
  }

  async salaryBenchmarks(): Promise<SalaryBenchmark[]> {
    const rows = await this.prisma.salaryBenchmark.findMany();
    return rows.map((s) => ({ role: s.role, low: s.low, high: s.high, current: s.current }));
  }
}
```

- [ ] **Step 2: Verify build does not regress**

Run: `cd /Users/ajaypradeepm/Work/NinjaHR\ project/ninja-hr-backend && npm run build 2>&1 | tail -20`
Expected: exit 0 (or same pre-existing errors as before — no new errors from this file).

---

### Task 4: CQRS Query Handlers

**Files:**
- Create: `src/contexts/people/application/queries/get-employees.query.ts`
- Create: `src/contexts/people/application/queries/get-employee-by-name.query.ts`
- Create: `src/contexts/people/application/queries/get-headcount.query.ts`
- Create: `src/contexts/people/application/queries/get-salary-benchmarks.query.ts`

**Interfaces:**
- Consumes: `PeopleRepository` from `../../infrastructure/people.repository`; `Employee`, `SalaryBenchmark` from `../../domain/people.types`.
- Produces: 4 query classes + 4 handler classes, each exported from their file, used by module and controller.

- [ ] **Step 1: Create GetEmployeesQuery**

Create `src/contexts/people/application/queries/get-employees.query.ts`:

```typescript
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PeopleRepository } from '../../infrastructure/people.repository';
import type { Employee } from '../../domain/people.types';

export class GetEmployeesQuery {}

@QueryHandler(GetEmployeesQuery)
export class GetEmployeesHandler implements IQueryHandler<GetEmployeesQuery, Employee[]> {
  constructor(private readonly repo: PeopleRepository) {}
  execute(): Promise<Employee[]> {
    return this.repo.getEmployees();
  }
}
```

- [ ] **Step 2: Create GetEmployeeByNameQuery**

Create `src/contexts/people/application/queries/get-employee-by-name.query.ts`:

```typescript
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PeopleRepository } from '../../infrastructure/people.repository';
import type { Employee } from '../../domain/people.types';

export class GetEmployeeByNameQuery {
  constructor(public readonly name: string) {}
}

@QueryHandler(GetEmployeeByNameQuery)
export class GetEmployeeByNameHandler
  implements IQueryHandler<GetEmployeeByNameQuery, Employee | null>
{
  constructor(private readonly repo: PeopleRepository) {}
  execute(query: GetEmployeeByNameQuery): Promise<Employee | null> {
    return this.repo.getEmployeeByName(query.name);
  }
}
```

- [ ] **Step 3: Create GetHeadcountQuery**

Create `src/contexts/people/application/queries/get-headcount.query.ts`:

```typescript
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PeopleRepository } from '../../infrastructure/people.repository';

export class GetHeadcountQuery {}

@QueryHandler(GetHeadcountQuery)
export class GetHeadcountHandler
  implements IQueryHandler<GetHeadcountQuery, { dept: string; count: number }[]>
{
  constructor(private readonly repo: PeopleRepository) {}
  execute(): Promise<{ dept: string; count: number }[]> {
    return this.repo.headcountByDept();
  }
}
```

- [ ] **Step 4: Create GetSalaryBenchmarksQuery**

Create `src/contexts/people/application/queries/get-salary-benchmarks.query.ts`:

```typescript
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PeopleRepository } from '../../infrastructure/people.repository';
import type { SalaryBenchmark } from '../../domain/people.types';

export class GetSalaryBenchmarksQuery {}

@QueryHandler(GetSalaryBenchmarksQuery)
export class GetSalaryBenchmarksHandler
  implements IQueryHandler<GetSalaryBenchmarksQuery, SalaryBenchmark[]>
{
  constructor(private readonly repo: PeopleRepository) {}
  execute(): Promise<SalaryBenchmark[]> {
    return this.repo.salaryBenchmarks();
  }
}
```

- [ ] **Step 5: Commit**

```bash
cd /Users/ajaypradeepm/Work/NinjaHR\ project/ninja-hr-backend
git add src/contexts/people/infrastructure/people.repository.ts \
        src/contexts/people/application/queries/get-employees.query.ts \
        src/contexts/people/application/queries/get-employee-by-name.query.ts \
        src/contexts/people/application/queries/get-headcount.query.ts \
        src/contexts/people/application/queries/get-salary-benchmarks.query.ts
git commit -m "$(cat <<'EOF'
feat(people): add repository and CQRS query handlers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Controller, Module, App Registration + Final Verification

**Files:**
- Create: `src/contexts/people/interface/people.controller.ts`
- Create: `src/contexts/people/people.module.ts`
- Modify: `src/app.module.ts`

**Interfaces:**
- Consumes: All 4 query classes/handlers from application/queries; `PeopleRepository`; `CqrsModule`; `QueryBus`.
- Produces: Running routes at `GET /api/v1/people/employees`, `GET /api/v1/people/employees/by-name/:name`, `GET /api/v1/people/headcount`, `GET /api/v1/people/salary-benchmarks`.

- [ ] **Step 1: Create the controller**

Create `src/contexts/people/interface/people.controller.ts`:

```typescript
// src/contexts/people/interface/people.controller.ts
import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { QueryBus } from '@nestjs/cqrs';
import { GetEmployeesQuery } from '../application/queries/get-employees.query';
import { GetEmployeeByNameQuery } from '../application/queries/get-employee-by-name.query';
import { GetHeadcountQuery } from '../application/queries/get-headcount.query';
import { GetSalaryBenchmarksQuery } from '../application/queries/get-salary-benchmarks.query';

@ApiTags('people')
@Controller('people')
export class PeopleController {
  constructor(private readonly queries: QueryBus) {}

  @Get('employees')
  getEmployees() {
    return this.queries.execute(new GetEmployeesQuery());
  }

  @Get('employees/by-name/:name')
  getEmployeeByName(@Param('name') name: string) {
    return this.queries.execute(new GetEmployeeByNameQuery(name));
  }

  @Get('headcount')
  getHeadcount() {
    return this.queries.execute(new GetHeadcountQuery());
  }

  @Get('salary-benchmarks')
  getSalaryBenchmarks() {
    return this.queries.execute(new GetSalaryBenchmarksQuery());
  }
}
```

- [ ] **Step 2: Create the module**

Create `src/contexts/people/people.module.ts`:

```typescript
// src/contexts/people/people.module.ts
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PeopleController } from './interface/people.controller';
import { PeopleRepository } from './infrastructure/people.repository';
import { GetEmployeesHandler } from './application/queries/get-employees.query';
import { GetEmployeeByNameHandler } from './application/queries/get-employee-by-name.query';
import { GetHeadcountHandler } from './application/queries/get-headcount.query';
import { GetSalaryBenchmarksHandler } from './application/queries/get-salary-benchmarks.query';

@Module({
  imports: [CqrsModule],
  controllers: [PeopleController],
  providers: [
    PeopleRepository,
    GetEmployeesHandler,
    GetEmployeeByNameHandler,
    GetHeadcountHandler,
    GetSalaryBenchmarksHandler,
  ],
})
export class PeopleModule {}
```

- [ ] **Step 3: Register PeopleModule in app.module.ts**

Read current `src/app.module.ts` (already done; current content is):

```typescript
import { Module } from '@nestjs/common';
import { DatabaseModule } from './platform/database/database.module';
import { HealthController } from './platform/health/health.controller';
import { OnboardingModule } from './contexts/onboarding/onboarding.module';

@Module({ imports: [DatabaseModule, OnboardingModule], controllers: [HealthController] })
export class AppModule {}
```

Replace it with:

```typescript
import { Module } from '@nestjs/common';
import { DatabaseModule } from './platform/database/database.module';
import { HealthController } from './platform/health/health.controller';
import { OnboardingModule } from './contexts/onboarding/onboarding.module';
import { PeopleModule } from './contexts/people/people.module';

@Module({ imports: [DatabaseModule, OnboardingModule, PeopleModule], controllers: [HealthController] })
export class AppModule {}
```

- [ ] **Step 4: Build**

Run: `cd /Users/ajaypradeepm/Work/NinjaHR\ project/ninja-hr-backend && npm run build 2>&1`
Expected: exit 0 — "Successfully compiled"

- [ ] **Step 5: Test**

Run: `cd /Users/ajaypradeepm/Work/NinjaHR\ project/ninja-hr-backend && npm test -- --no-coverage 2>&1 | tail -20`
Expected: all tests pass (including the new people mapper spec).

- [ ] **Step 6: Lint**

Run: `cd /Users/ajaypradeepm/Work/NinjaHR\ project/ninja-hr-backend && npm run lint 2>&1 | tail -20`
Expected: exit 0, no errors.

- [ ] **Step 7: Live check — start server and curl**

If the server isn't already running on :4000, start it in background:

```bash
cd /Users/ajaypradeepm/Work/NinjaHR\ project/ninja-hr-backend && npm run start:dev &
sleep 8
```

Then curl:

```bash
curl -s \
  -H "x-internal-key: dev-internal-key" \
  -H "x-actor-persona: admin" \
  http://localhost:4000/api/v1/people/employees | head -c 500
```

Expected: JSON array starting with `[{"id":"e1",...,"status":"Pre-Hire",...}` (display strings, not DB enums).

- [ ] **Step 8: Final commit**

```bash
cd /Users/ajaypradeepm/Work/NinjaHR\ project/ninja-hr-backend
git add src/contexts/people/interface/people.controller.ts \
        src/contexts/people/people.module.ts \
        src/app.module.ts
git commit -m "$(cat <<'EOF'
feat(people): add controller, module, and register in AppModule

Adds GET /people/employees, /people/employees/by-name/:name,
/people/headcount, /people/salary-benchmarks under api/v1 prefix.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- [x] `domain/people.types.ts` — Employee, EmployeeStatus, SalaryBenchmark — Task 1
- [x] `infrastructure/people.mapper.ts` — empStatusToDb, empStatusFromDb, rowToEmployee — Task 2
- [x] `infrastructure/people.mapper.spec.ts` — round-trip unit test — Task 2
- [x] `infrastructure/people.repository.ts` — getEmployees, getEmployeeByName, headcountByDept, salaryBenchmarks — Task 3
- [x] 4 query + handler files — Task 4
- [x] `interface/people.controller.ts` — 4 GET routes — Task 5
- [x] `people.module.ts` — CqrsModule import, repo + handlers + controller — Task 5
- [x] `app.module.ts` — PeopleModule registered — Task 5
- [x] DTO shapes frozen (Employee fields, SalaryBenchmark fields match lib/data.ts exactly)
- [x] empStatus map values match lib/db-map.ts exactly
- [x] Routes: GET /people/employees, /people/employees/by-name/:name, /people/headcount, /people/salary-benchmarks
- [x] Commit trailer correct

**Placeholder scan:** No TBD/TODO/placeholder text found.

**Type consistency:** `Employee` and `SalaryBenchmark` defined in Task 1, consumed in Tasks 2, 3, 4. `rowToEmployee` defined in Task 2, consumed in Task 3. Query/handler names consistent across Tasks 4 and 5.
