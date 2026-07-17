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
