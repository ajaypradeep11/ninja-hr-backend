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
  /** Employee self-assessment. Undefined until written. */
  selfEvaluation?: string;
  /** Manager's written assessment. Undefined until written. */
  managerEvaluation?: string;
  due: string; // ISO date YYYY-MM-DD
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
