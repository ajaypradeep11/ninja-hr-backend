// src/contexts/timeoff/domain/timeoff.types.ts
import type { ProvinceCode } from 'src/shared-kernel/province';

export type LeaveType =
  | 'Vacation'
  | 'Sick Leave'
  | 'Personal'
  | 'Parental'
  | 'Bereavement';

export type LeaveStatus = 'Pending' | 'Approved' | 'Denied';

export interface LeaveRequest {
  id: string;
  employee: string;
  type: LeaveType;
  start: string; // ISO date YYYY-MM-DD
  end: string;   // ISO date YYYY-MM-DD
  status: LeaveStatus;
  province: ProvinceCode;
  days: number;
}
