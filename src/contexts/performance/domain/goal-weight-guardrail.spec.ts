// src/contexts/performance/domain/goal-weight-guardrail.spec.ts
import {
  GOAL_WEIGHT_GUARDRAIL_PCT,
  exceedsWeightGuardrail,
  weightChangeDelta,
} from './goal-weight-guardrail';

describe('goal weight guardrail (constructive dismissal, 15% rule)', () => {
  it('threshold is 15 percentage points', () => {
    expect(GOAL_WEIGHT_GUARDRAIL_PCT).toBe(15);
  });

  it('a 10% change saves normally', () => {
    expect(exceedsWeightGuardrail(30, 40)).toBe(false);
  });

  it('a 20% change is blocked', () => {
    expect(exceedsWeightGuardrail(30, 50)).toBe(true);
  });

  it('exactly 15% is still allowed (block is strictly greater-than)', () => {
    expect(exceedsWeightGuardrail(30, 45)).toBe(false);
  });

  it('just over 15% is blocked', () => {
    expect(exceedsWeightGuardrail(30, 45.5)).toBe(true);
  });

  it('is direction-agnostic — a 20% reduction is equally blocked', () => {
    expect(exceedsWeightGuardrail(50, 30)).toBe(true);
    expect(exceedsWeightGuardrail(40, 30)).toBe(false);
  });

  it('no change is never blocked', () => {
    expect(exceedsWeightGuardrail(30, 30)).toBe(false);
  });

  it('delta is absolute percentage points', () => {
    expect(weightChangeDelta(30, 55)).toBe(25);
    expect(weightChangeDelta(55, 30)).toBe(25);
  });
});
