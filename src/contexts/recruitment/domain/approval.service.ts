// src/contexts/recruitment/domain/approval.service.ts
// Pure approval-settling rule: a requisition advances only when EVERY named
// approver has approved; a single rejection sends it back to Draft.

export type DbApprovalDecision = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ApprovalOutcome = 'approved' | 'rejected' | 'pending';

export function settleApprovals(decisions: DbApprovalDecision[]): ApprovalOutcome {
  if (decisions.some((d) => d === 'REJECTED')) return 'rejected';
  if (decisions.length > 0 && decisions.every((d) => d === 'APPROVED')) return 'approved';
  return 'pending';
}
