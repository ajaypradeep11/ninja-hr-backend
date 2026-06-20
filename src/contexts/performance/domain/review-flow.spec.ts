// src/contexts/performance/domain/review-flow.spec.ts
import { REVIEW_FLOW, nextReviewState } from './review-flow';
import type { ReviewState } from './performance.types';

describe('REVIEW_FLOW', () => {
  it('has exactly 5 states in order', () => {
    expect(REVIEW_FLOW).toEqual([
      'Draft',
      'Self-Evaluation',
      'Manager-Evaluation',
      'Calibrated',
      'Completed',
    ]);
  });
});

describe('nextReviewState', () => {
  it('advances Draft → Self-Evaluation', () => {
    expect(nextReviewState('Draft')).toBe('Self-Evaluation');
  });

  it('advances Self-Evaluation → Manager-Evaluation', () => {
    expect(nextReviewState('Self-Evaluation')).toBe('Manager-Evaluation');
  });

  it('advances Manager-Evaluation → Calibrated', () => {
    expect(nextReviewState('Manager-Evaluation')).toBe('Calibrated');
  });

  it('advances Calibrated → Completed', () => {
    expect(nextReviewState('Calibrated')).toBe('Completed');
  });

  it('clamps at Completed (does not advance past final state)', () => {
    expect(nextReviewState('Completed')).toBe('Completed');
  });

  it('each non-terminal state advances to the next', () => {
    const nonTerminal: ReviewState[] = [
      'Draft',
      'Self-Evaluation',
      'Manager-Evaluation',
      'Calibrated',
    ];
    for (const state of nonTerminal) {
      const idx = REVIEW_FLOW.indexOf(state);
      expect(nextReviewState(state)).toBe(REVIEW_FLOW[idx + 1]);
    }
  });
});
