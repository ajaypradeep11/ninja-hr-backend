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
}

export interface Candidate {
  id: string;
  name: string;
  role: string;
  stage: CandidateStage;
  matchScore: number;
  appliedDate: string; // ISO date YYYY-MM-DD
  interviewDate?: string; // ISO date YYYY-MM-DD, optional
  strengths: string[];
  gaps: string[];
}
