// src/contexts/timeoff/domain/timeoff.types.ts
import type { ProvinceCode } from 'src/shared-kernel/province';

export type LeaveType =
  | 'Vacation'
  | 'Sick Leave'
  | 'Personal'
  | 'Parental'
  | 'Bereavement'
  | 'Overtime';

export type LeaveStatus = 'Pending' | 'Approved' | 'Denied';

export interface LeaveRequest {
  id: string;
  employee: string;
  /** Display/search only — approval routing is by reporting line (managerId), not department. */
  department: string;
  type: LeaveType;
  start: string; // ISO date YYYY-MM-DD
  end: string;   // ISO date YYYY-MM-DD
  status: LeaveStatus;
  province: ProvinceCode;
  days: number;
  /** Partial-day request: hours taken on `start` (1–7). Undefined = full day(s). */
  hours?: number;
}
