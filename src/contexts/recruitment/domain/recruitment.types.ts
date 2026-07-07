// src/contexts/recruitment/domain/recruitment.types.ts
import type { ProvinceCode } from 'src/shared-kernel/province';

export type EmploymentType = 'Full-time' | 'Part-time' | 'Contractor';

export type RequisitionStatus = 'Draft' | 'Pending Approval' | 'Approved' | 'Published';

export type CandidateStage =
  | 'Applied'
  | 'AI Screened'
  | 'Interview'
  | 'Offer'
  | 'Hired'
  | 'Rejected';

export type ApprovalDecision = 'Pending' | 'Approved' | 'Rejected';
export type CandidateSource = 'Careers Site' | 'Indeed' | 'LinkedIn';

export interface Requisition {
  id: string;
  title: string;
  department: string;
  province: ProvinceCode;
  type: EmploymentType;
  salaryMin: number;
  salaryMax: number;
  status: RequisitionStatus;
  applicants: number;
  openedDate: string; // ISO date YYYY-MM-DD
  createdById?: string;
  createdByName?: string;
  slug?: string;
  archived: boolean;
  /** Admin-controlled Blind Hiring — non-HR viewers get scrubbed identities. */
  blindHiring: boolean;
  /** Candidates currently in the Interview stage (dashboard stat). */
  interviewsScheduled: number;
  /** Relationship of the requesting actor to this requisition (list views). */
  viewerIsHiringManager?: boolean;
  viewerOnHiringTeam?: boolean;
  viewerIsPanelMember?: boolean;
}

export interface ApprovalEntry {
  id: string;
  approverId: string;
  approverName: string;
  approverTitle: string;
  decision: ApprovalDecision;
  comment?: string;
  decidedAt?: string;
}

export interface HiringTeamEntry {
  id: string;
  employeeId: string;
  name: string;
  title: string;
  isPanelMember: boolean;
}

export interface PreScreenQuestionEntry {
  id: string;
  order: number;
  question: string;
  required: boolean;
}

export interface ScorecardCriterionEntry {
  id: string;
  name: string;
  weight?: number;
  /** Guiding questions/prompts shown to interviewers under this section. */
  guidance?: string;
  order: number;
}

export interface RequisitionDetail extends Requisition {
  jd?: string;
  publishedAt?: string;
  rejectionFeedback?: string;
  costOfHire?: number;
  indeedEnabled: boolean;
  linkedinEnabled: boolean;
  indeedUrl?: string;
  linkedinUrl?: string;
  approvals: ApprovalEntry[];
  hiringTeam: HiringTeamEntry[];
  preScreenQuestions: PreScreenQuestionEntry[];
  scorecardCriteria: ScorecardCriterionEntry[];
}

export interface Candidate {
  id: string;
  requisitionId?: string;
  name: string;
  role: string;
  stage: CandidateStage;
  matchScore: number;
  appliedDate: string; // ISO date YYYY-MM-DD
  interviewDate?: string; // ISO date YYYY-MM-DD, optional
  strengths: string[];
  gaps: string[];
  source: CandidateSource;
  withdrawn: boolean;
  anonymized: boolean;
}

/* --------------------------- Public job board --------------------------- */

/** Public-safe shape of a published posting (no approvals/team internals). */
export interface JobPosting {
  slug: string;
  title: string;
  department: string;
  province: ProvinceCode;
  type: EmploymentType;
  salaryMin: number;
  salaryMax: number;
  publishedAt?: string;
}

export interface JobPostingDetail extends JobPosting {
  jd: string;
  preScreenQuestions: PreScreenQuestionEntry[];
}

export interface ApplyInput {
  name: string;
  email: string;
  resumeText?: string;
  resumeFileBase64?: string;
  resumeFileName?: string;
  resumeMimeType?: string;
  source: CandidateSource;
  answers: { questionId: string; answer: string }[];
}

export interface ParsedResumeView {
  fileName?: string;
  /** Lets the UI decide whether the file can render inline (PDFs can). */
  mimeType?: string;
  parseStatus: 'PENDING' | 'PARSED' | 'FAILED' | 'SKIPPED';
  phone?: string;
  skills: string[];
  workHistory: { company: string; title: string; dates?: string }[];
  hasFile: boolean;
}

/* ---------------------------- Candidate portal --------------------------- */

/** Friendly status shown to candidates — no internal pipeline vocabulary. */
export type PortalStatus =
  | 'Application received'
  | 'Under review'
  | 'Interview stage'
  | 'Offer extended'
  | 'Hired'
  | 'Process complete'
  | 'Withdrawn';

export const STAGE_TO_PORTAL: Record<CandidateStage, PortalStatus> = {
  Applied: 'Application received',
  'AI Screened': 'Under review',
  Interview: 'Interview stage',
  Offer: 'Offer extended',
  Hired: 'Hired',
  Rejected: 'Process complete',
};

export interface PortalCommunication {
  subject: string;
  body: string;
  sentAt: string;
}

export interface PortalView {
  candidateName: string;
  jobTitle: string;
  status: PortalStatus;
  appliedDate: string;
  withdrawn: boolean;
  communications: PortalCommunication[];
}

export const PRIVACY_CONSENT_VERSION = 'careers-v1.0';

/* ------------------------ Candidate management -------------------------- */

export interface CommunicationEntry {
  id: string;
  subject: string;
  body: string;
  sentAt: string;
  sentByName?: string; // undefined = automated
  templateName?: string;
  visibleToCandidate: boolean;
  /** Two-way mailbox: Inbound = a reply from the candidate. */
  direction: 'Outbound' | 'Inbound';
  /** Raw From address on inbound mail. */
  fromAddress?: string;
}

export interface AnsweredQuestion {
  question: string;
  answer: string;
}

export interface ScorecardRatingEntry {
  criterionId: string;
  criterionName: string;
  rating: number;
  notes?: string;
}

export interface ScorecardEntry {
  id: string;
  panelistId: string;
  panelistName: string;
  recommendation: 'Strong Yes' | 'Yes' | 'No' | 'Strong No';
  overallNotes?: string;
  status: 'Draft' | 'Submitted';
  submittedAt: string;
  ratings: ScorecardRatingEntry[];
}

/** Aggregated evaluation KPIs across all submitted scorecards for a candidate. */
export interface EvaluationSummary {
  submittedCount: number;
  draftCount: number;
  averageOverall: number | null; // mean rating across all criteria (submitted only)
  perCriterion: { criterionId: string; name: string; average: number; count: number }[];
  recommendationMix: { recommendation: 'Strong Yes' | 'Yes' | 'No' | 'Strong No'; count: number }[];
}

export interface CandidateNoteEntry {
  id: string;
  authorName?: string;
  body: string;
  createdAt: string;
}

/** One section of an interview guide (template or per-requisition copy). */
export interface GuideSectionInput {
  name: string;
  weight?: number;
  /** Guiding questions/prompts shown to interviewers under this section. */
  guidance?: string;
}

export interface GuideTemplateSectionEntry extends GuideSectionInput {
  id: string;
  order: number;
}

/**
 * The built-in NinjaHR standard interview guide. Used to seed the editable
 * company template (and as the "Reset to standard" source). New requisitions
 * inherit whatever the company template currently says.
 */
export const DEFAULT_SCORECARD_SECTIONS: GuideSectionInput[] = [
  {
    name: 'Technical Fit',
    weight: 40,
    guidance:
      'What did they build most recently, and what was their specific contribution?\n' +
      'Walk through a hard problem they solved — approach over trivia.\n' +
      'How do they reason about trade-offs, quality and deadlines?',
  },
  {
    name: 'Culture Add',
    weight: 30,
    guidance:
      'What perspective or experience would they add to the team?\n' +
      'Ask for a concrete example of collaboration or giving/receiving feedback.\n' +
      'Assess what they add — not whether they fit a mold.',
  },
  {
    name: 'Communication',
    weight: 30,
    guidance:
      'Have them explain a complex topic as if to a non-expert.\n' +
      'Do they answer the question that was asked?\n' +
      'Signals from written materials (take-home, résumé, emails).',
  },
];

export interface CandidateDetail extends Candidate {
  email?: string;
  resumeText?: string;
  consentAt?: string;
  consentVersion?: string;
  answers: AnsweredQuestion[];
  communications: CommunicationEntry[];
  scorecards: ScorecardEntry[];
  notes: CandidateNoteEntry[];
  resume?: ParsedResumeView;
  requisitionTitle?: string;
  // Evaluation context so panelists can score without requisition-detail access.
  scorecardCriteria: ScorecardCriterionEntry[];
  viewerIsPanelMember: boolean;
  /** Debrief gating: panelists unlock others' feedback only after submitting. */
  viewerHasSubmitted: boolean;
  /** True when this payload was scrubbed by admin-controlled Blind Hiring. */
  blind: boolean;
  evaluationSummary: EvaluationSummary;
  auditTrail: { event: string; detail?: string; at: string }[];
}

export interface CommunicationTemplateEntry {
  id: string;
  name: string;
  subject: string;
  body: string;
  trigger: 'Application Received' | 'Interview Scheduled' | 'Rejected' | 'Manual';
  isDefault: boolean;
}

/* ------------------------------ Analytics ------------------------------- */

export interface RecruitmentAnalytics {
  funnel: { stage: CandidateStage; count: number }[];
  sources: { source: CandidateSource; count: number }[];
  applicantToInterview: { applicants: number; interviewed: number; ratioPct: number };
  timeToFill: { requisition: string; department: string; days: number }[];
  avgTimeToFillDays: number | null;
  costPerHire: { requisition: string; cost: number; hires: number; costPerHire: number }[];
  avgCostPerHire: number | null;
  byDepartment: { department: string; applicants: number; hired: number }[];
  withdrawnCount: number;
  evaluation: {
    avgInterviewScore: number | null;
    scorecardsSubmitted: number;
    candidatesScored: number;
    interviewedCandidates: number;
    recommendationMix: { recommendation: 'Strong Yes' | 'Yes' | 'No' | 'Strong No'; count: number }[];
  };
}
