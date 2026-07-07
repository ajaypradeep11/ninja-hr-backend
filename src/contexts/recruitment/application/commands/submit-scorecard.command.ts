// src/contexts/recruitment/application/commands/submit-scorecard.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RecruitmentRepository } from '../../infrastructure/recruitment.repository';
import type { ActorContext } from 'src/platform/auth/actor-context';
import type { CandidateDetail } from '../../domain/recruitment.types';

export class SubmitScorecardCommand {
  constructor(
    public readonly candidateId: string,
    public readonly input: {
      recommendation: 'Strong Yes' | 'Yes' | 'No' | 'Strong No';
      overallNotes?: string;
      ratings: { criterionId: string; rating: number; notes?: string }[];
      status?: 'DRAFT' | 'SUBMITTED';
    },
    public readonly actor: ActorContext,
  ) {}
}

@CommandHandler(SubmitScorecardCommand)
export class SubmitScorecardHandler
  implements ICommandHandler<SubmitScorecardCommand, CandidateDetail>
{
  constructor(private readonly repo: RecruitmentRepository) {}
  execute({ candidateId, input, actor }: SubmitScorecardCommand): Promise<CandidateDetail> {
    return this.repo.submitScorecard(candidateId, input, actor);
  }
}
