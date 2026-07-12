// src/contexts/performance/domain/probation.ts
// Probationary review automation: at Day 60 of tenure the system initializes
// the 90-day probationary review (and notifies the manager); at Day 80, if
// that review is still open, it escalates — the extension/termination call
// must be made before statutory notice starts applying at Day 90.

export const PROBATION_REVIEW_TRIGGER_DAY = 60;
export const PROBATION_ESCALATION_DAY = 80;
export const PROBATION_LENGTH_DAYS = 90;

/** Review-cycle label used for auto-initialized probationary reviews. */
export const PROBATION_CYCLE = '90-Day Probationary';

export type ProbationAction = 'initialize' | 'escalate' | 'none';

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Whole calendar days since hire (hire day = day 0). */
export function tenureDays(hireDate: Date, today: Date): number {
  return Math.floor(
    (startOfDay(today).getTime() - startOfDay(hireDate).getTime()) / 86_400_000,
  );
}

/** The probationary review is due at the end of the 90-day period.
 *  Preserves the hire date's clock time so UTC-midnight dates stay stable
 *  across timezones. */
export function probationDueDate(hireDate: Date): Date {
  const due = new Date(hireDate);
  due.setDate(due.getDate() + PROBATION_LENGTH_DAYS);
  return due;
}

export function probationAction(input: {
  tenureDays: number;
  hasProbationReview: boolean;
  reviewCompleted: boolean;
}): ProbationAction {
  if (!input.hasProbationReview) {
    // Day-60 trigger — also fires late (e.g. day 80+) if the review was never
    // created, since initializing it is the prerequisite for everything else.
    return input.tenureDays >= PROBATION_REVIEW_TRIGGER_DAY ? 'initialize' : 'none';
  }
  if (!input.reviewCompleted && input.tenureDays >= PROBATION_ESCALATION_DAY) {
    return 'escalate';
  }
  return 'none';
}
