// src/contexts/recruitment/domain/anti-bias.service.ts
//
// Anti-Bias Shield — hardcoded workflow constraint.
//
// The AI matching pipeline (resume parser / match scoring) may only SCORE and
// FLAG candidates. There is deliberately no rule engine, template trigger, or
// agent capable of moving a candidate to "Rejected": the single write path for
// stage changes is SetCandidateStageCommand, and rejections pass through the
// guard below. Communication templates with the "Rejected" trigger fire a
// message AFTER a human rejects — they never cause the rejection.
//
// Do not add an automated caller for rejections. Any "auto-reject below N%
// match" style rule must be refused at review time; this constant exists so
// such a feature cannot be toggled on via config.
import { ForbiddenException } from '@nestjs/common';
import type { ActorContext } from 'src/platform/auth/actor-context';

/** Hardcoded: the platform does not and must not support auto-rejection rules. */
export const AUTO_REJECTION_RULES_SUPPORTED = false as const;

/**
 * Throws unless the rejection is a manual decision by an identified human
 * reviewer. An automated caller (agent, cron, rule) has no employee identity,
 * so it can never pass this gate — and every rejection stays attributable in
 * the audit log.
 */
export function assertManualRejection(actor: ActorContext): void {
  if (!actor.employeeId) {
    throw new ForbiddenException(
      'Anti-Bias Shield: rejections require a manual decision by an identified human reviewer — automated rejection is not permitted.',
    );
  }
}
