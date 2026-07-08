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

/** Checklist task as accepted on write — ids are assigned by the database. */
export type ChecklistTaskInput = Omit<ChecklistTask, 'id'> & { id?: string };

export interface CaseDocument {
  id: string;
  name: string;
  type: string;
  folder: string;
  status: DocStatus;
  signedAt?: string;
  signedBy?: string;
  ip?: string;
  /** Set when the new hire uploaded a file (downloadable by HR to verify). */
  mimeType?: string;
  size?: number;
  hasFile: boolean;
}

/**
 * Whitelisted preboarding uploads. Each kind maps to a fixed document name so
 * re-uploads replace instead of duplicating, and everything routes to the
 * 02_Onboarding_and_Tax folder HR verifies from.
 */
export const UPLOAD_KINDS = {
  'td1-federal': { name: 'TD1 2026 — Federal (signed)', type: 'Tax Form' },
  'td1-ontario': { name: 'TD1ON 2026 — Ontario (signed)', type: 'Tax Form' },
  'benefits-enrollment': { name: 'Benefits Enrollment Form (completed)', type: 'Benefits' },
  'manual-acknowledgment': { name: 'Employee Manual Acknowledgment (signed)', type: 'Policy' },
} as const;

export type UploadKind = keyof typeof UPLOAD_KINDS;
export const DOCUMENTS_FOLDER = '02_Onboarding_and_Tax';

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

/** Canonical list of form keys — used to validate the `:key` URL param. */
export const FORM_KEYS = ['personal', 'td1', 'directDeposit', 'benefits', 'handbook'] as const satisfies readonly (keyof FormFlags)[];

export type WorkEligibilityLabel = 'Citizen' | 'Permanent Resident' | 'Work Permit' | 'Study Permit';

/**
 * Standard new-hire form (Ontario) — everything HR needs on file before day
 * one. Raw SIN and bank account live only in the DB column; every API read
 * passes through the mapper, which masks them to last digits.
 */
export interface NewHireProfile {
  legalFirstName: string;
  legalLastName: string;
  preferredName?: string;
  dateOfBirth: string; // ISO date
  /** Keep my birthday private — off team calendars/dashboards/announcements. */
  birthdayPrivate?: boolean;
  sin: string; // masked on read: ••• ••• 123
  phone: string;
  addressStreet: string;
  addressCity: string;
  addressPostal: string;
  emergencyName: string;
  emergencyRelationship: string;
  emergencyPhone: string;
  workEligibility: WorkEligibilityLabel;
  workPermitExpiry?: string;
  bankInstitution: string;
  bankTransit: string;
  bankAccount: string; // masked on read: ••••1234
  /** Must match the legal name — payroll deposits bounce otherwise. */
  bankAccountHolder: string;
  submittedAt: string;
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
  /** Present once the new hire submits the standard form (SIN/bank masked). */
  profile?: NewHireProfile;
  /** Per-department task ownership, e.g. { "HR": "Sarah Mitchell" }. */
  taskAssignees: Partial<Record<TaskOwner, string>>;
  checklist: ChecklistTask[];
  documents: CaseDocument[];
  consent: ConsentEntry[];
  policiesAttached: string[];
  auditLog: { at: string; event: string }[];
}

export const PRIVACY_POLICY_VERSION = 'v2.4';
