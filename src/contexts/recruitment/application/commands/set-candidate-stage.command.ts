// src/contexts/recruitment/application/commands/set-candidate-stage.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RecruitmentRepository } from '../../infrastructure/recruitment.repository';
import type { Candidate, CandidateStage } from '../../domain/recruitment.types';

export class SetCandidateStageCommand {
  constructor(
    public readonly id: string,
    public readonly stage: CandidateStage,
  ) {}
}

@CommandHandler(SetCandidateStageCommand)
export class SetCandidateStageHandler
  implements ICommandHandler<SetCandidateStageCommand, Candidate[]>
{
  constructor(private readonly repo: RecruitmentRepository) {}

  execute({ id, stage }: SetCandidateStageCommand): Promise<Candidate[]> {
    return this.repo.setCandidateStage(id, stage);
  }
}
