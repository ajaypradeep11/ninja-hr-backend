// src/contexts/recruitment/infrastructure/recruitment.mapper.ts
import type { ProvinceCode } from 'src/shared-kernel/province';
import type {
  Requisition,
  Candidate,
  EmploymentType,
  RequisitionStatus,
  CandidateStage,
} from '../domain/recruitment.types';

function invert<K extends string, V extends string>(m: Record<K, V>): Record<V, K> {
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k])) as Record<V, K>;
}

export const employmentTypeToDb = {
  'Full-time': 'FULL_TIME',
  'Part-time': 'PART_TIME',
  Contractor: 'CONTRACTOR',
} satisfies Record<EmploymentType, string>;

export const employmentTypeFromDb = invert(employmentTypeToDb);

export const reqStatusToDb = {
  Draft: 'DRAFT',
  'Pending Approval': 'PENDING_APPROVAL',
  Approved: 'APPROVED',
  Published: 'PUBLISHED',
} satisfies Record<RequisitionStatus, string>;

export const reqStatusFromDb = invert(reqStatusToDb);

export const candidateStageToDb = {
  Applied: 'APPLIED',
  'AI Screened': 'AI_SCREENED',
  Interview: 'INTERVIEW',
  Offer: 'OFFER',
  Hired: 'HIRED',
  Rejected: 'REJECTED',
} satisfies Record<CandidateStage, string>;

export const candidateStageFromDb = invert(candidateStageToDb);

const iso = (d: Date): string => d.toISOString().slice(0, 10);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToRequisition(row: any): Requisition {
  return {
    id: row.id,
    title: row.title,
    department: row.department,
    province: row.province as ProvinceCode,
    type: employmentTypeFromDb[row.type as keyof typeof employmentTypeFromDb],
    salaryMin: row.salaryMin,
    salaryMax: row.salaryMax,
    status: reqStatusFromDb[row.status as keyof typeof reqStatusFromDb],
    applicants: row.applicants,
    openedDate: iso(row.openedDate),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToCandidate(row: any): Candidate {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    stage: candidateStageFromDb[row.stage as keyof typeof candidateStageFromDb],
    matchScore: row.matchScore,
    appliedDate: iso(row.appliedDate),
    interviewDate: row.interviewDate ? iso(row.interviewDate) : undefined,
    strengths: row.strengths,
    gaps: row.gaps,
  };
}
