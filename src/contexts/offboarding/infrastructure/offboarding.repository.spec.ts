// src/contexts/offboarding/infrastructure/offboarding.repository.spec.ts
import { ConflictException, NotFoundException } from '@nestjs/common';
import { OffboardingRepository } from './offboarding.repository';
import type { TenantPrismaService } from 'src/platform/database/tenant-prisma.service';

/** Minimal tenant-prisma stub covering the tables the repository touches. */
function makePrisma() {
  return {
    offboardingTask: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
    },
    employee: {
      findMany: jest.fn().mockResolvedValue([{ id: 'emp-1' }]),
      update: jest.fn().mockResolvedValue({}),
    },
    leaveRequest: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    agentRun: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
    },
  };
}

function activeParentalLeave() {
  const start = new Date();
  start.setDate(start.getDate() - 30);
  const end = new Date();
  end.setDate(end.getDate() + 90);
  return { type: 'PARENTAL', status: 'APPROVED', start, end };
}

describe('OffboardingRepository.finalizeTermination — statutory leave lock', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let repo: OffboardingRepository;

  beforeEach(() => {
    prisma = makePrisma();
    repo = new OffboardingRepository(prisma as unknown as TenantPrismaService);
  });

  it('blocks termination while the employee is on active statutory leave', async () => {
    prisma.leaveRequest.findMany.mockResolvedValue([activeParentalLeave()]);

    await expect(repo.finalizeTermination({ employeeName: 'Pam Beesly' })).rejects.toThrow(
      ConflictException,
    );
    await expect(repo.finalizeTermination({ employeeName: 'Pam Beesly' })).rejects.toThrow(
      /STATUTORY_LEAVE_LOCK/,
    );
    expect(prisma.employee.update).not.toHaveBeenCalled();
  });

  it('still blocks when the override flag is set WITHOUT the HR certification', async () => {
    prisma.leaveRequest.findMany.mockResolvedValue([activeParentalLeave()]);

    await expect(
      repo.finalizeTermination({ employeeName: 'Pam Beesly', statutoryOverride: true }),
    ).rejects.toThrow(/STATUTORY_LEAVE_LOCK/);
    expect(prisma.employee.update).not.toHaveBeenCalled();
  });

  it('still blocks when the certification is set WITHOUT the override flag', async () => {
    prisma.leaveRequest.findMany.mockResolvedValue([activeParentalLeave()]);

    await expect(
      repo.finalizeTermination({ employeeName: 'Pam Beesly', hrCertified: true }),
    ).rejects.toThrow(/STATUTORY_LEAVE_LOCK/);
    expect(prisma.employee.update).not.toHaveBeenCalled();
  });

  it('terminates when override AND Human Rights Code certification are both given', async () => {
    prisma.leaveRequest.findMany.mockResolvedValue([activeParentalLeave()]);

    await repo.finalizeTermination({
      employeeName: 'Pam Beesly',
      statutoryOverride: true,
      hrCertified: true,
    });

    expect(prisma.employee.update).toHaveBeenCalledWith({
      where: { id: 'emp-1' },
      data: { status: 'TERMINATED' },
    });
    // The bypass is recorded on the offboarding board.
    expect(prisma.offboardingTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          label: expect.stringContaining('Statutory-leave override APPLIED'),
          status: 'COMPLETED',
          blocking: false,
        }),
      }),
    );
  });

  it('terminates normally when no statutory leave is active', async () => {
    prisma.leaveRequest.findMany.mockResolvedValue([
      // Non-statutory + ended statutory leaves must not trip the lock.
      { type: 'VACATION', status: 'APPROVED', start: new Date('2026-01-01'), end: new Date('2027-01-01') },
      { type: 'PARENTAL', status: 'APPROVED', start: new Date('2025-01-01'), end: new Date('2025-06-01') },
    ]);

    await repo.finalizeTermination({ employeeName: 'Stanley Hudson' });

    expect(prisma.employee.update).toHaveBeenCalledWith({
      where: { id: 'emp-1' },
      data: { status: 'TERMINATED' },
    });
  });

  it('persists a structured termination record when details are provided', async () => {
    await repo.finalizeTermination({
      employeeName: 'Stanley Hudson',
      terminationType: 'Voluntary',
      reason: 'Retirement',
      rehireEligible: true,
      notes: 'Gave 4 weeks notice',
    });

    expect(prisma.offboardingTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          label:
            'Termination record — Stanley Hudson · Type: Voluntary · Reason: Retirement · Rehire eligible: Yes · Notes: Gave 4 weeks notice',
          owner: 'HR_PAYROLL',
        }),
      }),
    );
  });

  it('keeps the blocking-task gate ahead of everything else', async () => {
    prisma.offboardingTask.findMany.mockResolvedValue([{ label: 'Recover laptop / hardware' }]);

    await expect(repo.finalizeTermination({ employeeName: 'Stanley Hudson' })).rejects.toThrow(
      /blocking offboarding tasks incomplete/,
    );
    expect(prisma.employee.update).not.toHaveBeenCalled();
  });

  it('404s on an unknown employee', async () => {
    prisma.employee.findMany.mockResolvedValue([]);

    await expect(repo.finalizeTermination({ employeeName: 'Nobody' })).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('OffboardingRepository.saveOffboarding', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let repo: OffboardingRepository;

  beforeEach(() => {
    prisma = makePrisma();
    repo = new OffboardingRepository(prisma as unknown as TenantPrismaService);
  });

  it('moves the employee to OFFBOARDING and records the saved case', async () => {
    prisma.employee.findMany.mockResolvedValue([{ id: 'emp-1', status: 'ACTIVE' }]);

    await repo.saveOffboarding('Stanley Hudson', 'Sales Team Offboarding');

    expect(prisma.employee.update).toHaveBeenCalledWith({
      where: { id: 'emp-1' },
      data: { status: 'OFFBOARDING' },
    });
    expect(prisma.agentRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          intent: 'Offboarding case saved for Stanley Hudson (Sales Team Offboarding)',
        }),
      }),
    );
  });

  it('does not duplicate the saved-case record on re-save', async () => {
    prisma.employee.findMany.mockResolvedValue([{ id: 'emp-1', status: 'OFFBOARDING' }]);
    prisma.agentRun.findFirst.mockResolvedValue({ id: 'run-1' });

    await repo.saveOffboarding('Stanley Hudson', 'Sales Team Offboarding');

    expect(prisma.agentRun.create).not.toHaveBeenCalled();
  });

  it('rejects saving a case for an already-terminated employee', async () => {
    prisma.employee.findMany.mockResolvedValue([{ id: 'emp-1', status: 'TERMINATED' }]);

    await expect(repo.saveOffboarding('Stanley Hudson')).rejects.toThrow(ConflictException);
    expect(prisma.employee.update).not.toHaveBeenCalled();
  });

  it('404s on an unknown employee', async () => {
    prisma.employee.findMany.mockResolvedValue([]);

    await expect(repo.saveOffboarding('Nobody')).rejects.toThrow(NotFoundException);
  });
});
