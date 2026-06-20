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
