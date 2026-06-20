// src/contexts/onboarding/infrastructure/onboarding.mapper.ts
import type { ProvinceCode } from 'src/shared-kernel/province';
import type {
  OnboardingCase, CaseStatus, TaskOwner, TaskStatus, DataAccess, DocStatus, FormFlags,
} from '../domain/onboarding.types';

function invert<K extends string, V extends string>(m: Record<K, V>): Record<V, K> {
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k])) as Record<V, K>;
}

export const caseStatusToDb = {
  Invited: 'INVITED',
  'Forms In Progress': 'FORMS_IN_PROGRESS',
  'Pending Verification': 'PENDING_VERIFICATION',
  'Ready to Activate': 'READY_TO_ACTIVATE',
  Active: 'ACTIVE',
} satisfies Record<CaseStatus, string>;
export const caseStatusFromDb = invert(caseStatusToDb);

export const ownerToDb = {
  HR: 'HR', Finance: 'FINANCE', 'IT / Ops': 'IT_OPS', Manager: 'MANAGER',
} satisfies Record<TaskOwner, string>;
export const ownerFromDb = invert(ownerToDb);

export const taskStatusToDb = {
  Pending: 'PENDING', 'In-Progress': 'IN_PROGRESS', Completed: 'COMPLETED',
} satisfies Record<TaskStatus, string>;
export const taskStatusFromDb = invert(taskStatusToDb);

export const accessToDb = {
  general: 'GENERAL', banking: 'BANKING', medical: 'MEDICAL',
} satisfies Record<DataAccess, string>;
export const accessFromDb = invert(accessToDb);

export const docStatusToDb = {
  Pending: 'PENDING', 'Needs Verification': 'NEEDS_VERIFICATION', Verified: 'VERIFIED',
} satisfies Record<DocStatus, string>;
export const docStatusFromDb = invert(docStatusToDb);

const d = (date: Date | null | undefined, len = 10): string | undefined =>
  date ? date.toISOString().slice(0, len) : undefined;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToCase(row: any): OnboardingCase {
  return {
    id: row.id,
    token: row.token,
    name: row.name,
    title: row.title,
    department: row.department,
    province: row.province as ProvinceCode,
    startDate: d(row.startDate)!,
    personalEmail: row.personalEmail,
    status: caseStatusFromDb[row.status as keyof typeof caseStatusFromDb],
    createdAt: d(row.createdAt)!,
    forms: row.forms as FormFlags,
    policiesAttached: row.policiesAttached,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    checklist: row.checklist.map((t: any) => ({
      id: t.id, label: t.label, owner: ownerFromDb[t.owner as keyof typeof ownerFromDb],
      status: taskStatusFromDb[t.status as keyof typeof taskStatusFromDb], blocking: t.blocking,
      dataAccess: accessFromDb[t.dataAccess as keyof typeof accessFromDb],
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    documents: row.documents.map((doc: any) => ({
      id: doc.id, name: doc.name, type: doc.type, folder: doc.folder,
      status: docStatusFromDb[doc.status as keyof typeof docStatusFromDb],
      signedAt: d(doc.signedAt), signedBy: doc.signedBy ?? undefined, ip: doc.ip ?? undefined,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    consent: row.consent.map((e: any) => ({
      policy: e.policy, version: e.version, timestamp: d(e.timestamp, 19)!, ip: e.ip,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    auditLog: row.auditLog.map((a: any) => ({ at: d(a.at, 19)!, event: a.event })),
  };
}
