// src/contexts/timeoff/infrastructure/timeoff.mapper.ts
import type { ProvinceCode } from 'src/shared-kernel/province';
import type { LeaveRequest, LeaveType, LeaveStatus } from '../domain/timeoff.types';

function invert<K extends string, V extends string>(m: Record<K, V>): Record<V, K> {
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k])) as Record<V, K>;
}

export const leaveTypeToDb = {
  Vacation: 'VACATION',
  'Sick Leave': 'SICK',
  Personal: 'PERSONAL',
  Parental: 'PARENTAL',
  Bereavement: 'BEREAVEMENT',
} satisfies Record<LeaveType, string>;

export const leaveTypeFromDb = invert(leaveTypeToDb);

export const leaveStatusToDb = {
  Pending: 'PENDING',
  Approved: 'APPROVED',
  Denied: 'DENIED',
} satisfies Record<LeaveStatus, string>;

export const leaveStatusFromDb = invert(leaveStatusToDb);

const iso = (d: Date): string => d.toISOString().slice(0, 10);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToLeaveRequest(row: any): LeaveRequest {
  return {
    id: row.id,
    employee: row.employee.name,
    type: leaveTypeFromDb[row.type as keyof typeof leaveTypeFromDb],
    start: iso(row.start),
    end: iso(row.end),
    status: leaveStatusFromDb[row.status as keyof typeof leaveStatusFromDb],
    province: row.employee.province as ProvinceCode,
    days: row.days,
  };
}
