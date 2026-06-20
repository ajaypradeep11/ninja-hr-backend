import type { ProvinceCode } from 'src/shared-kernel/province';

export type EmployeeStatus =
  | 'Active'
  | 'Pre-Hire'
  | 'On Statutory Leave'
  | 'Offboarding'
  | 'Terminated';

export interface Employee {
  id: string;
  name: string;
  title: string;
  department: string;
  province: ProvinceCode;
  email: string;
  hireDate: string;   // ISO date YYYY-MM-DD
  birthDate: string;  // ISO date YYYY-MM-DD
  manager?: string;
  status: EmployeeStatus;
  salary: number;
  avatar?: string;
}

export interface SalaryBenchmark {
  role: string;
  low: number;
  high: number;
  current: number;
}
