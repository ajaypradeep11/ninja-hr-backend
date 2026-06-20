// src/contexts/performance/domain/review-flow.ts
import type { ReviewState } from './performance.types';

export const REVIEW_FLOW: ReviewState[] = [
  'Draft',
  'Self-Evaluation',
  'Manager-Evaluation',
  'Calibrated',
  'Completed',
];

/**
 * Returns the next state in the review flow, clamped at 'Completed'.
 * Mirrors the frontend advanceReviewState logic exactly.
 */
export function nextReviewState(current: ReviewState): ReviewState {
  const idx = REVIEW_FLOW.indexOf(current);
  const nextIdx = Math.min(REVIEW_FLOW.length - 1, idx + 1);
  return REVIEW_FLOW[nextIdx];
}
