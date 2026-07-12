// src/contexts/offboarding/domain/termination-guard.spec.ts
import {
  findActiveStatutoryLeave,
  formatTerminationRecord,
  hasTerminationDetails,
  STATUTORY_LEAVE_DB_TYPES,
} from './termination-guard';

const TODAY = new Date('2026-07-12T15:30:00');

function leave(over: Partial<{ type: string; status: string; start: string; end: string }> = {}) {
  return {
    type: over.type ?? 'PARENTAL',
    status: over.status ?? 'APPROVED',
    start: new Date(over.start ?? '2026-05-01'),
    end: new Date(over.end ?? '2026-12-01'),
  };
}

describe('STATUTORY_LEAVE_DB_TYPES', () => {
  it('covers parental (incl. maternity), sick and bereavement', () => {
    expect(STATUTORY_LEAVE_DB_TYPES).toEqual(['PARENTAL', 'SICK', 'BEREAVEMENT']);
  });
});

describe('findActiveStatutoryLeave', () => {
  it('finds an approved parental leave covering today', () => {
    const found = findActiveStatutoryLeave([leave()], TODAY);
    expect(found).not.toBeNull();
    expect(found!.type).toBe('PARENTAL');
  });

  it('ignores pending (unapproved) statutory leave', () => {
    expect(findActiveStatutoryLeave([leave({ status: 'PENDING' })], TODAY)).toBeNull();
  });

  it('ignores denied statutory leave', () => {
    expect(findActiveStatutoryLeave([leave({ status: 'DENIED' })], TODAY)).toBeNull();
  });

  it('ignores non-statutory leave types (vacation, personal, overtime)', () => {
    for (const type of ['VACATION', 'PERSONAL', 'OVERTIME']) {
      expect(findActiveStatutoryLeave([leave({ type })], TODAY)).toBeNull();
    }
  });

  it('ignores a statutory leave that ended before today', () => {
    expect(
      findActiveStatutoryLeave([leave({ start: '2026-06-01', end: '2026-07-11' })], TODAY),
    ).toBeNull();
  });

  it('ignores a statutory leave that starts after today', () => {
    expect(
      findActiveStatutoryLeave([leave({ start: '2026-07-13', end: '2026-09-01' })], TODAY),
    ).toBeNull();
  });

  it('is inclusive on the start and end dates', () => {
    expect(
      findActiveStatutoryLeave([leave({ start: '2026-07-12', end: '2026-07-12' })], TODAY),
    ).not.toBeNull();
  });

  it('finds sick and bereavement statutory leaves too', () => {
    for (const type of ['SICK', 'BEREAVEMENT']) {
      expect(
        findActiveStatutoryLeave([leave({ type, start: '2026-07-10', end: '2026-07-14' })], TODAY),
      ).not.toBeNull();
    }
  });

  it('returns null for an empty list', () => {
    expect(findActiveStatutoryLeave([], TODAY)).toBeNull();
  });
});

describe('hasTerminationDetails', () => {
  it('is false when nothing was provided', () => {
    expect(hasTerminationDetails({})).toBe(false);
    expect(hasTerminationDetails({ reason: '  ', notes: '' })).toBe(false);
  });

  it('is true for any single provided field', () => {
    expect(hasTerminationDetails({ terminationType: 'Voluntary' })).toBe(true);
    expect(hasTerminationDetails({ reason: 'Restructuring' })).toBe(true);
    expect(hasTerminationDetails({ rehireEligible: false })).toBe(true);
    expect(hasTerminationDetails({ notes: 'Exit call held' })).toBe(true);
  });
});

describe('formatTerminationRecord', () => {
  it('renders the full structured record', () => {
    expect(
      formatTerminationRecord(
        'Stanley Hudson',
        {
          terminationType: 'Involuntary',
          reason: 'Restructuring / position eliminated',
          rehireEligible: true,
          notes: 'Package accepted',
        },
        false,
      ),
    ).toBe(
      'Termination record — Stanley Hudson · Type: Involuntary · Reason: Restructuring / position eliminated · Rehire eligible: Yes · Notes: Package accepted',
    );
  });

  it('records the statutory override with certification when applied', () => {
    const record = formatTerminationRecord('Pam Beesly', { terminationType: 'Involuntary' }, true);
    expect(record).toContain('Statutory-leave override APPLIED with Human Rights Code certification');
  });

  it('omits absent fields', () => {
    expect(formatTerminationRecord('A B', {})).toBe('Termination record — A B');
  });
});
