// src/contexts/offboarding/domain/termination-guard.ts
// Statutory-leave termination lock (ESA / Human Rights Code guardrail).
//
// Terminating an employee while they are on a job-protected statutory leave
// (parental/maternity, sick, bereavement) is presumptively reprisal under the
// ESA and exposes the company to Human Rights Code claims. The system
// hard-blocks it; HR can only proceed with an explicit override PLUS a
// recorded Human Rights Code certification.

/** DB LeaveType values that are job-protected statutory (ESA) leaves.
 *  Maternity/pregnancy leave is filed under PARENTAL — the LeaveType enum has
 *  no separate MATERNITY value. Vacation/Personal/Overtime are not
 *  job-protected leaves of absence. */
export const STATUTORY_LEAVE_DB_TYPES = ['PARENTAL', 'SICK', 'BEREAVEMENT'] as const;

export const STATUTORY_LEAVE_LABELS: Record<string, string> = {
  PARENTAL: 'Parental / Maternity',
  SICK: 'Sick',
  BEREAVEMENT: 'Bereavement',
};

/** Marker prefix the frontend keys on to render the hardstop override UI. */
export const STATUTORY_LOCK_MARKER = 'STATUTORY_LEAVE_LOCK';

export interface LeaveWindow {
  /** DB LeaveType value (e.g. 'PARENTAL'). */
  type: string;
  /** DB LeaveStatus value (e.g. 'APPROVED'). */
  status: string;
  start: Date;
  end: Date;
}

/** Leave rows store calendar dates as UTC midnights; `today` is server-local.
 *  Compare as ISO calendar-date strings so day boundaries never drift with
 *  the server timezone. */
const leaveDay = (d: Date): string => d.toISOString().slice(0, 10);
const localDay = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The APPROVED statutory leave covering `today` (inclusive), or null. */
export function findActiveStatutoryLeave(
  leaves: LeaveWindow[],
  today: Date,
): LeaveWindow | null {
  const day = localDay(today);
  return (
    leaves.find(
      (l) =>
        l.status === 'APPROVED' &&
        (STATUTORY_LEAVE_DB_TYPES as readonly string[]).includes(l.type) &&
        leaveDay(l.start) <= day &&
        day <= leaveDay(l.end),
    ) ?? null
  );
}

export type TerminationType = 'Voluntary' | 'Involuntary';

export interface TerminationDetails {
  terminationType?: TerminationType;
  reason?: string;
  rehireEligible?: boolean;
  notes?: string;
}

export function hasTerminationDetails(d: TerminationDetails): boolean {
  return (
    d.terminationType !== undefined ||
    !!d.reason?.trim() ||
    d.rehireEligible !== undefined ||
    !!d.notes?.trim()
  );
}

/** Renders the termination record persisted as a completed HR/Payroll task —
 *  the schema has no dedicated termination-detail fields, so the structured
 *  details are stored as a single audit line on the offboarding board. */
export function formatTerminationRecord(
  employeeName: string,
  details: TerminationDetails,
  statutoryOverride = false,
): string {
  return [
    `Termination record — ${employeeName}`,
    details.terminationType ? `Type: ${details.terminationType}` : null,
    details.reason?.trim() ? `Reason: ${details.reason.trim()}` : null,
    details.rehireEligible !== undefined
      ? `Rehire eligible: ${details.rehireEligible ? 'Yes' : 'No'}`
      : null,
    statutoryOverride
      ? 'Statutory-leave override APPLIED with Human Rights Code certification'
      : null,
    details.notes?.trim() ? `Notes: ${details.notes.trim()}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
