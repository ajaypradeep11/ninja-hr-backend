// src/contexts/offboarding/infrastructure/offboarding.mapper.spec.ts
import {
  ownerToDb,
  ownerFromDb,
  statusToDb,
  statusFromDb,
  rowToTask,
} from './offboarding.mapper';

describe('ownerToDb / ownerFromDb', () => {
  it('maps Manager ↔ MANAGER', () => {
    expect(ownerToDb['Manager']).toBe('MANAGER');
    expect(ownerFromDb['MANAGER']).toBe('Manager');
  });

  it('maps IT / Ops ↔ IT_OPS', () => {
    expect(ownerToDb['IT / Ops']).toBe('IT_OPS');
    expect(ownerFromDb['IT_OPS']).toBe('IT / Ops');
  });

  it('maps HR / Payroll ↔ HR_PAYROLL', () => {
    expect(ownerToDb['HR / Payroll']).toBe('HR_PAYROLL');
    expect(ownerFromDb['HR_PAYROLL']).toBe('HR / Payroll');
  });

  it('round-trips all owners', () => {
    const owners = ['Manager', 'IT / Ops', 'HR / Payroll'] as const;
    for (const o of owners) {
      expect(ownerFromDb[ownerToDb[o]]).toBe(o);
    }
  });
});

describe('statusToDb / statusFromDb', () => {
  it('maps Pending ↔ PENDING', () => {
    expect(statusToDb['Pending']).toBe('PENDING');
    expect(statusFromDb['PENDING']).toBe('Pending');
  });

  it('maps In-Progress ↔ IN_PROGRESS', () => {
    expect(statusToDb['In-Progress']).toBe('IN_PROGRESS');
    expect(statusFromDb['IN_PROGRESS']).toBe('In-Progress');
  });

  it('maps Completed ↔ COMPLETED', () => {
    expect(statusToDb['Completed']).toBe('COMPLETED');
    expect(statusFromDb['COMPLETED']).toBe('Completed');
  });

  it('round-trips all statuses', () => {
    const statuses = ['Pending', 'In-Progress', 'Completed'] as const;
    for (const s of statuses) {
      expect(statusFromDb[statusToDb[s]]).toBe(s);
    }
  });
});

describe('rowToTask', () => {
  it('maps a DB row to OffboardingTask shape', () => {
    const row = {
      id: 'task1',
      label: 'Return equipment',
      owner: 'IT_OPS',
      status: 'IN_PROGRESS',
      blocking: true,
    };
    expect(rowToTask(row)).toEqual({
      id: 'task1',
      label: 'Return equipment',
      owner: 'IT / Ops',
      status: 'In-Progress',
      blocking: true,
    });
  });

  it('maps PENDING status correctly', () => {
    const row = {
      id: 'task2',
      label: 'Final paycheck',
      owner: 'HR_PAYROLL',
      status: 'PENDING',
      blocking: false,
    };
    const task = rowToTask(row);
    expect(task.status).toBe('Pending');
    expect(task.owner).toBe('HR / Payroll');
  });

  it('maps COMPLETED status correctly', () => {
    const row = {
      id: 'task3',
      label: 'Exit interview',
      owner: 'MANAGER',
      status: 'COMPLETED',
      blocking: false,
    };
    const task = rowToTask(row);
    expect(task.status).toBe('Completed');
    expect(task.owner).toBe('Manager');
  });
});
