// src/contexts/performance/domain/probation.spec.ts
import {
  PROBATION_CYCLE,
  PROBATION_ESCALATION_DAY,
  PROBATION_LENGTH_DAYS,
  PROBATION_REVIEW_TRIGGER_DAY,
  probationAction,
  probationDueDate,
  tenureDays,
} from './probation';

describe('probation constants', () => {
  it('trigger at day 60, escalate at day 80, 90-day period', () => {
    expect(PROBATION_REVIEW_TRIGGER_DAY).toBe(60);
    expect(PROBATION_ESCALATION_DAY).toBe(80);
    expect(PROBATION_LENGTH_DAYS).toBe(90);
    expect(PROBATION_CYCLE).toBe('90-Day Probationary');
  });
});

describe('tenureDays', () => {
  it('counts whole days since hire (hire day = 0)', () => {
    expect(tenureDays(new Date('2026-05-13'), new Date('2026-07-12'))).toBe(60);
    expect(tenureDays(new Date('2026-07-12'), new Date('2026-07-12'))).toBe(0);
  });

  it('ignores time-of-day', () => {
    expect(
      tenureDays(new Date('2026-05-13T23:59:00'), new Date('2026-07-12T00:01:00')),
    ).toBe(60);
  });
});

describe('probationDueDate', () => {
  it('is hire date + 90 days', () => {
    expect(probationDueDate(new Date('2026-04-01')).toISOString().slice(0, 10)).toBe(
      '2026-06-30',
    );
  });
});

describe('probationAction — Day-60 initialization boundary', () => {
  it('does nothing at day 59 with no review', () => {
    expect(
      probationAction({ tenureDays: 59, hasProbationReview: false, reviewCompleted: false }),
    ).toBe('none');
  });

  it('initializes at exactly day 60', () => {
    expect(
      probationAction({ tenureDays: 60, hasProbationReview: false, reviewCompleted: false }),
    ).toBe('initialize');
  });

  it('initializes late (day 80+) when the review was never created', () => {
    expect(
      probationAction({ tenureDays: 85, hasProbationReview: false, reviewCompleted: false }),
    ).toBe('initialize');
  });

  it('does not re-initialize when the review already exists', () => {
    expect(
      probationAction({ tenureDays: 61, hasProbationReview: true, reviewCompleted: false }),
    ).toBe('none');
  });
});

describe('probationAction — Day-80 escalation boundary', () => {
  it('does not escalate at day 79 with an open review', () => {
    expect(
      probationAction({ tenureDays: 79, hasProbationReview: true, reviewCompleted: false }),
    ).toBe('none');
  });

  it('escalates at exactly day 80 with an open review', () => {
    expect(
      probationAction({ tenureDays: 80, hasProbationReview: true, reviewCompleted: false }),
    ).toBe('escalate');
  });

  it('does not escalate when the review is already completed', () => {
    expect(
      probationAction({ tenureDays: 80, hasProbationReview: true, reviewCompleted: true }),
    ).toBe('none');
  });

  it('keeps escalating past day 80 while the review stays open', () => {
    expect(
      probationAction({ tenureDays: 89, hasProbationReview: true, reviewCompleted: false }),
    ).toBe('escalate');
  });
});
