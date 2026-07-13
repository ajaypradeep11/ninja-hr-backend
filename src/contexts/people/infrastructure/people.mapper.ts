import type { ProvinceCode } from 'src/shared-kernel/province';
import type {
  Employee,
  EmployeeDetail,
  EmployeeStatus,
  EmploymentType,
  PayFrequency,
  WorkEligibility,
} from '../domain/people.types';

function invert<K extends string, V extends string>(m: Record<K, V>): Record<V, K> {
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k])) as Record<V, K>;
}

export const empStatusToDb = {
  Active: 'ACTIVE',
  'Pre-Hire': 'PRE_HIRE',
  'On Statutory Leave': 'ON_STATUTORY_LEAVE',
  Offboarding: 'OFFBOARDING',
  Terminated: 'TERMINATED',
} satisfies Record<EmployeeStatus, string>;

export const empStatusFromDb = invert(empStatusToDb);

const iso = (d: Date): string => d.toISOString().slice(0, 10);

export const employmentTypeToDb = {
  'Full-time': 'FULL_TIME',
  'Part-time': 'PART_TIME',
  Contractor: 'CONTRACTOR',
} satisfies Record<EmploymentType, string>;
export const employmentTypeFromDb = invert(employmentTypeToDb);

export const payFrequencyToDb = {
  Weekly: 'WEEKLY',
  'Bi-weekly': 'BIWEEKLY',
  'Semi-monthly': 'SEMIMONTHLY',
  Monthly: 'MONTHLY',
} satisfies Record<PayFrequency, string>;
export const payFrequencyFromDb = invert(payFrequencyToDb);

export const workEligibilityToDb = {
  Citizen: 'CITIZEN',
  'Permanent Resident': 'PERMANENT_RESIDENT',
  'Work Permit': 'WORK_PERMIT',
  'Study Permit': 'STUDY_PERMIT',
} satisfies Record<WorkEligibility, string>;
export const workEligibilityFromDb = invert(workEligibilityToDb);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToEmployee(row: any): Employee {
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    department: row.department,
    province: row.province as ProvinceCode,
    email: row.email,
    hireDate: iso(row.hireDate),
    birthDate: iso(row.birthDate),
    birthdayPrivate: row.birthdayPrivate ?? false,
    manager: row.manager ?? undefined,
    status: empStatusFromDb[row.status as keyof typeof empStatusFromDb],
    salary: row.salary,
    employeeNumber: row.employeeNumber ?? undefined,
  };
}

/** Mask all but the last `visible` chars of a sensitive value. */
export function maskTail(value: string | null | undefined, visible = 3): string | undefined {
  if (!value) return undefined;
  const digits = value.replace(/\s/g, '');
  if (digits.length <= visible) return '•'.repeat(digits.length);
  return `${'•'.repeat(Math.max(3, digits.length - visible))}${digits.slice(-visible)}`;
}

/**
 * Full HRIS record. Sensitive fields (SIN, bank account) are ALWAYS masked —
 * the raw values never leave the backend. `hasSin`/`hasBanking` tell the UI
 * whether data exists without exposing it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToEmployeeDetail(row: any): EmployeeDetail {
  return {
    ...rowToEmployee(row),
    preferredName: row.preferredName ?? undefined,
    pronouns: row.pronouns ?? undefined,
    personalEmail: row.personalEmail ?? undefined,
    phone: row.phone ?? undefined,
    addressStreet: row.addressStreet ?? undefined,
    addressCity: row.addressCity ?? undefined,
    addressProvince: (row.addressProvince as ProvinceCode) ?? undefined,
    addressPostal: row.addressPostal ?? undefined,
    employmentType: row.employmentType
      ? employmentTypeFromDb[row.employmentType as keyof typeof employmentTypeFromDb]
      : undefined,
    workLocation: row.workLocation ?? undefined,
    payFrequency: row.payFrequency
      ? payFrequencyFromDb[row.payFrequency as keyof typeof payFrequencyFromDb]
      : undefined,
    workEligibility: row.workEligibility
      ? workEligibilityFromDb[row.workEligibility as keyof typeof workEligibilityFromDb]
      : undefined,
    workPermitExpiry: row.workPermitExpiry ? iso(row.workPermitExpiry) : undefined,
    td1FederalOnFile: row.td1FederalOnFile,
    td1ProvincialOnFile: row.td1ProvincialOnFile,
    sinMasked: maskTail(row.sin, 3),
    hasSin: !!row.sin,
    bankInstitution: row.bankInstitution ?? undefined,
    bankTransit: row.bankTransit ?? undefined,
    bankAccountMasked: maskTail(row.bankAccount, 4),
    hasBanking: !!(row.bankInstitution || row.bankAccount),
    emergencyContacts: (row.emergencyContacts ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any) => ({
        id: c.id,
        name: c.name,
        relationship: c.relationship,
        phone: c.phone,
        altPhone: c.altPhone ?? undefined,
        email: c.email ?? undefined,
        isPrimary: c.isPrimary,
      }),
    ),
    documents: (row.documents ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (d: any) => ({
        id: d.id,
        name: d.name,
        type: d.type,
        folder: d.folder,
        hasFile: d.mimeType != null,
        uploaded: iso(d.uploaded),
      }),
    ),
  };
}
