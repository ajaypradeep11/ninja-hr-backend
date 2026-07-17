import { empStatusToDb, empStatusFromDb, rowToEmployee } from './people.mapper';

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
