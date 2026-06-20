// src/contexts/onboarding/domain/onboarding.types.ts
import type { ProvinceCode } from 'src/shared-kernel/province';

export type CaseStatus =
  | 'Invited'
  | 'Forms In Progress'
  | 'Pending Verification'
  | 'Ready to Activate'
  | 'Active';

export type TaskOwner = 'HR' | 'Finance' | 'IT / Ops' | 'Manager';
export type TaskStatus = 'Pending' | 'In-Progress' | 'Completed';
export type DataAccess = 'general' | 'banking' | 'medical';
export type DocStatus = 'Pending' | 'Needs Verification' | 'Verified';

export interface ChecklistTask {
  id: string;
  label: string;
  owner: TaskOwner;
  status: TaskStatus;
  blocking: boolean;
  dataAccess: DataAccess;
}

export interface CaseDocument {
  id: string;
  name: string;
  type: string;
  folder: string;
  status: DocStatus;
  signedAt?: string;
  signedBy?: string;
  ip?: string;
}

export interface ConsentEntry {
  policy: string;
  version: string;
  timestamp: string;
  ip: string;
}

export interface FormFlags {
  personal: boolean;
  td1: boolean;
  directDeposit: boolean;
  benefits: boolean;
  handbook: boolean;
}

export interface OnboardingCase {
  id: string;
  token: string;
  name: string;
  title: string;
  department: string;
  province: ProvinceCode;
  startDate: string;
  personalEmail: string;
  status: CaseStatus;
  createdAt: string;
  forms: FormFlags;
  checklist: ChecklistTask[];
  documents: CaseDocument[];
  consent: ConsentEntry[];
  policiesAttached: string[];
  auditLog: { at: string; event: string }[];
}

export const PRIVACY_POLICY_VERSION = 'v2.4';
