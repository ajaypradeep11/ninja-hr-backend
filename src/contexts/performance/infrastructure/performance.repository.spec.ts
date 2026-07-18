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
