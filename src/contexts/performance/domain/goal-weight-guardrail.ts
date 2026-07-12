// src/contexts/performance/domain/goal-weight-guardrail.ts
// Constructive-dismissal guardrail: unilaterally changing a signed goal's
// weight (core responsibility share) by more than 15 percentage points is a
// substantial change to the employment terms. Such changes must not save
// directly — they are blocked and routed to a mutual-consent approval flow.

export const GOAL_WEIGHT_GUARDRAIL_PCT = 15;

/** Marker prefix the frontend keys on to render the routed-to-approvals state. */
export const WEIGHT_GUARDRAIL_MARKER = 'WEIGHT_GUARDRAIL';

/** Absolute change in percentage points, direction-agnostic. */
export function weightChangeDelta(previousWeight: number, proposedWeight: number): number {
  return Math.abs(proposedWeight - previousWeight);
}

/** True when the change must be blocked and routed for mutual consent. */
export function exceedsWeightGuardrail(previousWeight: number, proposedWeight: number): boolean {
  return weightChangeDelta(previousWeight, proposedWeight) > GOAL_WEIGHT_GUARDRAIL_PCT;
}
