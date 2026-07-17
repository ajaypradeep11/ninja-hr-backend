import type { ProvinceCode } from 'src/shared-kernel/province';

export type EmployeeStatus =
  | 'Active'
  | 'Pre-Hire'
  | 'On Statutory Leave'
  | 'Offboarding'
  | 'Terminated';

export type EmploymentType = 'Full-time' | 'Part-time' | 'Contractor';
export type PayFrequency = 'Weekly' | 'Bi-weekly' | 'Semi-monthly' | 'Monthly';
export type WorkEligibility = 'Citizen' | 'Permanent Resident' | 'Work Permit' | 'Study Permit';

export interface Employee {
  id: string;
  name: string;
  title: string;
  department: string;
  province: ProvinceCode;
  email: string;
  hireDate: string;   // ISO date YYYY-MM-DD
  /** ISO date YYYY-MM-DD — blanked for non-HR viewers when birthdayPrivate. */
  birthDate: string;
  manager?: string;
  managerId?: string;
  status: EmployeeStatus;
  salary: number;
  avatar?: string;
  employeeNumber?: string;
  /** Hide birthday from team calendars/dashboards; HR always sees the DOB. */
  birthdayPrivate: boolean;
}

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  altPhone?: string;
  email?: string;
  isPrimary: boolean;
}

export interface EmployeeDocumentRef {
  id: string;
  name: string;
  type: string;
  folder: string;
  uploaded: string;
}

/** Full HRIS record — sensitive fields (SIN, bank account) are masked. */
export interface EmployeeDetail extends Employee {
  preferredName?: string;
  pronouns?: string;
  personalEmail?: string;
  phone?: string;
  addressStreet?: string;
  addressCity?: string;
  addressProvince?: ProvinceCode;
  addressPostal?: string;
  employmentType?: EmploymentType;
  workLocation?: string;
  payFrequency?: PayFrequency;
  workEligibility?: WorkEligibility;
  workPermitExpiry?: string;
  td1FederalOnFile: boolean;
  td1ProvincialOnFile: boolean;
  sinMasked?: string;
  hasSin: boolean;
  bankInstitution?: string;
  bankTransit?: string;
  bankAccountMasked?: string;
  hasBanking: boolean;
  emergencyContacts: EmergencyContact[];
  documents: EmployeeDocumentRef[];
  /** Direct reports — the reverse side of the manager relation. */
  reportees?: { id: string; name: string; title: string }[];
}

/** Manual HR-created profile — for hires made outside the recruiting/onboarding flows. */
export interface CreateEmployeeInput {
  name: string;
  title: string;
  department: string;
  province: ProvinceCode;
  email: string;
  hireDate: string;
  birthDate?: string;
  salary?: number;
  employmentType?: EmploymentType;
  workLocation?: string;
  preferredName?: string;
  phone?: string;
  manager?: string;
  managerId?: string;
}

/** HRIS fields an HR user may edit (raw sensitive values accepted here). */
export interface UpdateEmployeeInput {
  birthdayPrivate?: boolean;
  name?: string;
  hireDate?: string;
  birthDate?: string;
  title?: string;
  department?: string;
  manager?: string;
  managerId?: string;
  status?: EmployeeStatus;
  salary?: number;
  employeeNumber?: string;
  preferredName?: string;
  pronouns?: string;
  personalEmail?: string;
  phone?: string;
  addressStreet?: string;
  addressCity?: string;
  addressProvince?: ProvinceCode;
  addressPostal?: string;
  employmentType?: EmploymentType;
  workLocation?: string;
  payFrequency?: PayFrequency;
  workEligibility?: WorkEligibility;
  workPermitExpiry?: string;
  td1FederalOnFile?: boolean;
  td1ProvincialOnFile?: boolean;
  sin?: string;
  bankInstitution?: string;
  bankTransit?: string;
  bankAccount?: string;
}

export interface EmergencyContactInput {
  name: string;
  relationship: string;
  phone: string;
  altPhone?: string;
  email?: string;
  isPrimary?: boolean;
}

export interface SalaryBenchmark {
  role: string;
  low: number;
  high: number;
  current: number;
}
