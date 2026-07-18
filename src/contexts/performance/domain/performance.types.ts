// src/contexts/performance/domain/performance.types.ts

export type ReviewState =
  | 'Draft'
  | 'Self-Evaluation'
  | 'Manager-Evaluation'
  | 'Calibrated'
  | 'Completed';

export type PipState = 'Draft' | 'Active' | 'Completed';

export interface PerformanceReview {
  id: string;
  employee: string;
  cycle: string;
  state: ReviewState;
  score?: number;
  /** Employee self-assessment. Undefined until written (or hidden by visibility gating). */
  selfEvaluation?: string;
  /** Manager's written assessment. Undefined until written (or hidden by visibility gating). */
  managerEvaluation?: string;
  /** ISO datetime when the employee submitted their self-assessment. */
  selfSubmittedAt?: string;
  /** ISO datetime when the assigned manager submitted their evaluation. */
  managerSubmittedAt?: string;
  /** ISO datetime when the employee acknowledged the completed review. */
  acknowledgedAt?: string;
  due: string; // ISO date YYYY-MM-DD
}

/** The actor-scoped review surface: own reviews + direct reports' reviews. */
export interface MyReviews {
  /** The actor's own reviews (manager eval + score hidden until Completed). */
  mine: PerformanceReview[];
  /** Reviews of the actor's direct reports (self-eval hidden until submitted). */
  reports: PerformanceReview[];
}

export interface Pip {
  id: string;
  employee: string;
  manager: string;
  durationDays: number;
  state: PipState;
  signedByManager: boolean;
  signedByEmployee: boolean;
  startDate: string; // ISO date YYYY-MM-DD
}
