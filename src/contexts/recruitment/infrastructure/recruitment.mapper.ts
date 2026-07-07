// src/contexts/recruitment/infrastructure/recruitment.mapper.ts
import type { ProvinceCode } from 'src/shared-kernel/province';
import type {
  Requisition,
  RequisitionDetail,
  Candidate,
  EmploymentType,
  RequisitionStatus,
  CandidateStage,
  ApprovalDecision,
  CandidateSource,
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

export const approvalDecisionToDb = {
  Pending: 'PENDING',
  Approved: 'APPROVED',
  Rejected: 'REJECTED',
} satisfies Record<ApprovalDecision, string>;

export const approvalDecisionFromDb = invert(approvalDecisionToDb);

export const candidateSourceToDb = {
  'Careers Site': 'CAREERS',
  Indeed: 'INDEED',
  LinkedIn: 'LINKEDIN',
} satisfies Record<CandidateSource, string>;

export const candidateSourceFromDb = invert(candidateSourceToDb);

export const recommendationToDb = {
  'Strong Yes': 'STRONG_YES',
  Yes: 'YES',
  No: 'NO',
  'Strong No': 'STRONG_NO',
} as const;

export const recommendationFromDb = invert(recommendationToDb);

export const triggerToDb = {
  'Application Received': 'APPLICATION_RECEIVED',
  'Interview Scheduled': 'INTERVIEW_SCHEDULED',
  Rejected: 'REJECTED',
  Manual: 'MANUAL',
} as const;

export const triggerFromDb = invert(triggerToDb);

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
    createdById: row.createdById ?? undefined,
    createdByName: row.createdBy?.name ?? undefined,
    slug: row.slug ?? undefined,
    archived: !!row.archivedAt,
    blindHiring: !!row.blindHiring,
    // Populated when the query includes a filtered candidate _count (list views).
    interviewsScheduled: row._count?.candidates ?? 0,
  };
}

/** Maps a requisition row loaded with approvals/team/questions/criteria includes. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToRequisitionDetail(row: any): RequisitionDetail {
  return {
    ...rowToRequisition(row),
    jd: row.jd ?? undefined,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : undefined,
    rejectionFeedback: row.rejectionFeedback ?? undefined,
    costOfHire: row.costOfHire ?? undefined,
    indeedEnabled: row.indeedEnabled,
    linkedinEnabled: row.linkedinEnabled,
    indeedUrl: row.indeedUrl ?? undefined,
    linkedinUrl: row.linkedinUrl ?? undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    approvals: row.approvals.map((a: any) => ({
      id: a.id,
      approverId: a.approverId,
      approverName: a.approver.name,
      approverTitle: a.approver.title,
      decision: approvalDecisionFromDb[a.decision as keyof typeof approvalDecisionFromDb],
      comment: a.comment ?? undefined,
      decidedAt: a.decidedAt ? a.decidedAt.toISOString() : undefined,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    hiringTeam: row.hiringTeam.map((m: any) => ({
      id: m.id,
      employeeId: m.employeeId,
      name: m.employee.name,
      title: m.employee.title,
      isPanelMember: m.isPanelMember,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    preScreenQuestions: row.preScreenQuestions.map((q: any) => ({
      id: q.id,
      order: q.order,
      question: q.question,
      required: q.required,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scorecardCriteria: row.scorecardCriteria.map((c: any) => ({
      id: c.id,
      name: c.name,
      weight: c.weight ?? undefined,
      guidance: c.guidance ?? undefined,
      order: c.order,
    })),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToCandidate(row: any): Candidate {
  return {
    id: row.id,
    requisitionId: row.requisitionId ?? undefined,
    name: row.name,
    role: row.role,
    stage: candidateStageFromDb[row.stage as keyof typeof candidateStageFromDb],
    matchScore: row.matchScore,
    appliedDate: iso(row.appliedDate),
    interviewDate: row.interviewDate ? iso(row.interviewDate) : undefined,
    strengths: row.strengths,
    gaps: row.gaps,
    source: candidateSourceFromDb[row.source as keyof typeof candidateSourceFromDb],
    withdrawn: !!row.withdrawnAt,
    anonymized: !!row.anonymizedAt,
  };
}
