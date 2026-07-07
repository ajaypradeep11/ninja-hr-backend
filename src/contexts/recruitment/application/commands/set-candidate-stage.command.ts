// src/contexts/recruitment/application/commands/set-candidate-stage.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RecruitmentRepository } from '../../infrastructure/recruitment.repository';
import type { ActorContext } from 'src/platform/auth/actor-context';
import type { Candidate, CandidateStage } from '../../domain/recruitment.types';
import { assertManualRejection } from '../../domain/anti-bias.service';

export class SetCandidateStageCommand {
  constructor(
    public readonly id: string,
    public readonly stage: CandidateStage,
    public readonly actor: ActorContext,
  ) {}
}

@CommandHandler(SetCandidateStageCommand)
export class SetCandidateStageHandler
  implements ICommandHandler<SetCandidateStageCommand, Candidate[]>
{
  constructor(private readonly repo: RecruitmentRepository) {}

  async execute({ id, stage, actor }: SetCandidateStageCommand): Promise<Candidate[]> {
    // Anti-Bias Shield: the AI scores and flags only — a move to "Rejected"
    // must be a manual decision by an identified human reviewer.
    if (stage === 'Rejected') assertManualRejection(actor);
    // Only HR or the hiring team of the candidate's requisition may move them.
    await this.repo.assertCandidateAccess(id, actor);
    return this.repo.setCandidateStageScoped(id, stage, actor);
  }
}
