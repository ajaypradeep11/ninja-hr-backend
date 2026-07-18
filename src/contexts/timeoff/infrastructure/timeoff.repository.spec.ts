// src/contexts/timeoff/infrastructure/timeoff.repository.spec.ts
import { ForbiddenException } from '@nestjs/common';
import { TimeoffRepository } from './timeoff.repository';
import { rowToLeaveRequest } from './timeoff.mapper';
import type { ActorContext } from 'src/platform/auth/actor-context';

const actor = (over: Partial<ActorContext>): ActorContext => ({
  userId: 'u',
  employeeId: 'e',
  employeeName: 'N',
  department: 'Engineering',
  role: 'EMPLOYEE',
  realUserId: 'u',
  companyId: 'c1',
  ...over,
});

function makePrisma() {
  return {
    leaveRequest: {
      findMany: jest.fn(async () => []),
      findUnique: jest.fn(),
      update: jest.fn(async () => ({})),
    },
  };
}

describe('TimeoffRepository.getLeaveRequests routing (by reporting line)', () => {
  it('HR_ADMIN sees the whole company (no where filter)', async () => {
    const prisma = makePrisma();
    await new TimeoffRepository(prisma as never).getLeaveRequests(actor({ role: 'HR_ADMIN' }));
    expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it('a manager sees their OWN requests plus everyone who reports to them (managerId), regardless of department', async () => {
    const prisma = makePrisma();
    // A People-dept manager (Aleena) with an Engineering-dept report must still see it.
    await new TimeoffRepository(prisma as never).getLeaveRequests(
      actor({ role: 'MANAGER', employeeId: 'mgr1', department: 'People' }),
    );
    expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ employeeId: 'mgr1' }, { employee: { managerId: 'mgr1' } }] },
      }),
    );
  });

  it('routing is role-agnostic: an EMPLOYEE-role user who has direct reports still sees them', async () => {
    const prisma = makePrisma();
    await new TimeoffRepository(prisma as never).getLeaveRequests(
      actor({ role: 'EMPLOYEE', employeeId: 'boss' }),
    );
    expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ employeeId: 'boss' }, { employee: { managerId: 'boss' } }] },
      }),
    );
  });

  it('the persona lane (no employeeId) resolves to nobody, never everyone', async () => {
    const prisma = makePrisma();
    await new TimeoffRepository(prisma as never).getLeaveRequests(
      actor({ role: 'EMPLOYEE', employeeId: null }),
    );
    expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { employeeId: '__none__' } }),
    );
  });
});

describe('TimeoffRepository.updateStatus authorization (by reporting line)', () => {
  const row = { id: 'lr1', employee: { name: 'Ajay', managerId: 'mgr1' } };

  it("lets the requester's assigned manager approve", async () => {
    const prisma = makePrisma();
    prisma.leaveRequest.findUnique.mockResolvedValue(row);
    await new TimeoffRepository(prisma as never).updateStatus(
      'lr1',
      'Approved',
      actor({ role: 'MANAGER', employeeId: 'mgr1', department: 'People' }),
    );
    expect(prisma.leaveRequest.update).toHaveBeenCalled();
  });

  it('lets HR override regardless of reporting line', async () => {
    const prisma = makePrisma();
    prisma.leaveRequest.findUnique.mockResolvedValue(row);
    await new TimeoffRepository(prisma as never).updateStatus(
      'lr1',
      'Denied',
      actor({ role: 'HR_ADMIN', employeeId: 'hr1' }),
    );
    expect(prisma.leaveRequest.update).toHaveBeenCalled();
  });

  it('forbids a non-HR user who is NOT the assigned manager', async () => {
    const prisma = makePrisma();
    prisma.leaveRequest.findUnique.mockResolvedValue(row);
    await expect(
      new TimeoffRepository(prisma as never).updateStatus(
        'lr1',
        'Approved',
        actor({ role: 'MANAGER', employeeId: 'someone-else' }),
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.leaveRequest.update).not.toHaveBeenCalled();
  });

  it('forbids the persona lane (no employeeId)', async () => {
    const prisma = makePrisma();
    prisma.leaveRequest.findUnique.mockResolvedValue(row);
    await expect(
      new TimeoffRepository(prisma as never).updateStatus(
        'lr1',
        'Approved',
        actor({ role: 'EMPLOYEE', employeeId: null }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});

describe('TimeoffRepository.createLeave persists the employee note', () => {
  const makeCreatePrisma = () => ({
    employee: { findFirst: jest.fn(async () => ({ id: 'emp1' })) },
    leaveRequest: { create: jest.fn(async () => ({})) },
  });
  const base = { employeeName: 'Ajay', type: 'Vacation' as const, start: '2026-07-21', end: '2026-07-25', days: 5 };

  it('passes the note through to the created row', async () => {
    const prisma = makeCreatePrisma();
    await new TimeoffRepository(prisma as never).createLeave({ ...base, note: 'Family trip out of province' });
    expect(prisma.leaveRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ note: 'Family trip out of province' }) }),
    );
  });

  it('stores null when no note is given', async () => {
    const prisma = makeCreatePrisma();
    await new TimeoffRepository(prisma as never).createLeave(base);
    expect(prisma.leaveRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ note: null }) }),
    );
  });
});

describe('rowToLeaveRequest exposes the note', () => {
  const base = {
    id: 'lr1',
    employee: { name: 'Ajay', department: 'Engineering', province: 'ON' },
    type: 'VACATION',
    start: new Date('2026-07-21'),
    end: new Date('2026-07-25'),
    status: 'PENDING',
    days: 5,
    hours: null,
  };

  it('maps a present note', () => {
    expect(rowToLeaveRequest({ ...base, note: 'Family trip' }).note).toBe('Family trip');
  });

  it('maps a null note to undefined', () => {
    expect(rowToLeaveRequest({ ...base, note: null }).note).toBeUndefined();
  });
});
