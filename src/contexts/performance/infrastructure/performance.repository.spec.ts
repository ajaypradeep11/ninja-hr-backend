// src/contexts/performance/infrastructure/performance.repository.spec.ts
import { PerformanceRepository } from './performance.repository';
import type { TenantPrismaService } from 'src/platform/database/tenant-prisma.service';

// Employee.manager used to be a free-text NAME column; it is now a relation
// (managerId -> Employee). `select: { manager: true }` therefore joins the
// whole related Employee object, not a string — a naive `${emp.manager}`
// interpolation silently renders "[object Object]".
describe('PerformanceRepository.runProbationSweep', () => {
  function makePrisma(managerValue: unknown) {
    return {
      employee: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'e1',
            name: 'New Hire',
            manager: managerValue,
            hireDate: new Date('2026-01-01T00:00:00Z'),
          },
        ]),
      },
      performanceReview: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({}),
      },
      agentRun: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({}),
      },
    };
  }

  it('renders the manager NAME in the Day-60 agent-run summary, not the joined object', async () => {
    const prisma = makePrisma({ id: 'm1', name: 'Grace Hopper' });
    const repo = new PerformanceRepository(prisma as unknown as TenantPrismaService);

    // Day-60+ tenure relative to "now" so the sweep triggers 'initialize'.
    await repo.runProbationSweep(new Date('2026-03-15T00:00:00Z'));

    const summary = prisma.agentRun.create.mock.calls[0][0].data.summary as string;
    expect(summary).toContain('Grace Hopper');
    expect(summary).not.toContain('[object Object]');
  });

  it('falls back to "unassigned" when the employee has no manager', async () => {
    const prisma = makePrisma(null);
    const repo = new PerformanceRepository(prisma as unknown as TenantPrismaService);

    await repo.runProbationSweep(new Date('2026-03-15T00:00:00Z'));

    const summary = prisma.agentRun.create.mock.calls[0][0].data.summary as string;
    expect(summary).toContain('unassigned');
  });
});

describe('PerformanceRepository.createReview', () => {
  function makePrisma() {
    return {
      performanceReview: {
        findMany: jest.fn(async () => []),
        create: jest.fn(async () => ({})),
        update: jest.fn(async () => ({})),
      },
    };
  }

  it('creates a review in Draft for the employee/cycle/due', async () => {
    const prisma = makePrisma();
    await new PerformanceRepository(prisma as never).createReview({
      employeeId: 'emp1',
      cycle: '2026 Annual',
      due: '2026-12-31',
    });
    expect(prisma.performanceReview.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ employeeId: 'emp1', cycle: '2026 Annual', state: 'DRAFT' }),
      }),
    );
    const call = prisma.performanceReview.create.mock.calls[0] as unknown as [{ data: { due: Date } }];
    expect(call[0].data.due.toISOString().slice(0, 10)).toBe('2026-12-31');
  });

  it('writes only the review fields provided on update', async () => {
    const prisma = makePrisma();
    await new PerformanceRepository(prisma as never).updateReview('r1', {
      managerEvaluation: 'Exceeded goals this cycle.',
      score: 4.5,
    });
    expect(prisma.performanceReview.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { managerEvaluation: 'Exceeded goals this cycle.', score: 4.5 },
    });
  });
});

describe('Participatory review flow', () => {
  const HR = { userId: 'u-hr', employeeId: 'e-hr', employeeName: 'HR', department: 'People', role: 'HR_ADMIN', realUserId: 'u-hr', companyId: 'c1' } as never;
  const AJAY = { userId: 'u-a', employeeId: 'e-ajay', employeeName: 'Ajay', department: 'Eng', role: 'EMPLOYEE', realUserId: 'u-a', companyId: 'c1' } as never;
  const JANE = { userId: 'u-j', employeeId: 'e-jane', employeeName: 'Jane', department: 'Eng', role: 'EMPLOYEE', realUserId: 'u-j', companyId: 'c1' } as never;

  function makePrisma(rows: Record<string, unknown>[]) {
    return {
      performanceReview: {
        findMany: jest.fn(async () => rows),
        findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
          rows.find((r) => (r as { id: string }).id === where.id) ?? null),
        updateMany: jest.fn(async () => ({ count: 1 })),
        update: jest.fn(async () => ({})),
      },
    };
  }

  // Jane reports to Ajay. Jane's review is mid-flow.
  const janeRow = {
    id: 'rv1',
    employeeId: 'e-jane',
    employee: { name: 'Jane', managerId: 'e-ajay' },
    cycle: '2026 Annual',
    state: 'SELF_EVALUATION',
    score: 3.5,
    selfEvaluation: 'my self eval draft',
    managerEvaluation: 'mgr words',
    selfSubmittedAt: null,
    managerSubmittedAt: null,
    acknowledgedAt: null,
    due: new Date('2026-12-31'),
  };

  it('getMyReviews hides manager eval + score from the employee until Completed', async () => {
    const prisma = makePrisma([janeRow]);
    const out = await new PerformanceRepository(prisma as never).getMyReviews(JANE);
    expect(out.mine).toHaveLength(1);
    expect(out.mine[0].managerEvaluation).toBeUndefined();
    expect(out.mine[0].score).toBeUndefined();
    expect(out.mine[0].selfEvaluation).toBe('my self eval draft');
  });

  it("getMyReviews hides the report's UNSUBMITTED self-eval from the manager (independent opinion)", async () => {
    const prisma = makePrisma([janeRow]);
    const out = await new PerformanceRepository(prisma as never).getMyReviews(AJAY);
    expect(out.reports).toHaveLength(1);
    expect(out.reports[0].selfEvaluation).toBeUndefined();
  });

  it("shows the report's self-eval to the manager once submitted", async () => {
    const prisma = makePrisma([{ ...janeRow, selfSubmittedAt: new Date() }]);
    const out = await new PerformanceRepository(prisma as never).getMyReviews(AJAY);
    expect(out.reports[0].selfEvaluation).toBe('my self eval draft');
  });

  it('submitSelfEvaluation: owner-only, Self-Evaluation stage only, auto-advances', async () => {
    const prisma = makePrisma([janeRow]);
    const repo = new PerformanceRepository(prisma as never);
    await repo.submitSelfEvaluation('rv1', 'final self eval', JANE);
    expect(prisma.performanceReview.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rv1', state: 'SELF_EVALUATION' },
        data: expect.objectContaining({ selfEvaluation: 'final self eval', state: 'MANAGER_EVALUATION' }),
      }),
    );
    await expect(repo.submitSelfEvaluation('rv1', 'x', AJAY)).rejects.toThrow(/Only the review/);
  });

  it('submitManagerEvaluation: assigned manager or HR, Manager-Evaluation stage only', async () => {
    const inStage = { ...janeRow, state: 'MANAGER_EVALUATION' };
    const prisma = makePrisma([inStage]);
    const repo = new PerformanceRepository(prisma as never);
    await repo.submitManagerEvaluation('rv1', 'great cycle', 4, AJAY);
    expect(prisma.performanceReview.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rv1', state: 'MANAGER_EVALUATION' },
        data: expect.objectContaining({ managerEvaluation: 'great cycle', score: 4, state: 'CALIBRATED' }),
      }),
    );
    // A random employee (not the assigned manager) is refused.
    await expect(repo.submitManagerEvaluation('rv1', 'x', 1, JANE)).rejects.toThrow(/manager/);
    // HR override is allowed.
    await expect(repo.submitManagerEvaluation('rv1', 'hr words', undefined, HR)).resolves.toBeDefined();
  });

  it('acknowledgeReview: owner-only, Completed-only, idempotent', async () => {
    const done = { ...janeRow, state: 'COMPLETED', acknowledgedAt: null };
    const prisma = makePrisma([done]);
    const repo = new PerformanceRepository(prisma as never);
    await repo.acknowledgeReview('rv1', JANE);
    expect(prisma.performanceReview.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'rv1' }, data: expect.objectContaining({ acknowledgedAt: expect.any(Date) }) }),
    );
    await expect(repo.acknowledgeReview('rv1', AJAY)).rejects.toThrow(/Only the review/);
    const notDone = makePrisma([janeRow]);
    await expect(new PerformanceRepository(notDone as never).acknowledgeReview('rv1', JANE)).rejects.toThrow(/completed/);
  });
});
