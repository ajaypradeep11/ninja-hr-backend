// src/contexts/recruitment/application/commands/set-scorecard-criteria.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RecruitmentRepository } from '../../infrastructure/recruitment.repository';
import type { ActorContext } from 'src/platform/auth/actor-context';
import type { RequisitionDetail } from '../../domain/recruitment.types';

export class SetScorecardCriteriaCommand {
  constructor(
    public readonly requisitionId: string,
    public readonly criteria: { name: string; weight?: number }[],
    public readonly actor: ActorContext,
  ) {}
}

@CommandHandler(SetScorecardCriteriaCommand)
export class SetScorecardCriteriaHandler
  implements ICommandHandler<SetScorecardCriteriaCommand, RequisitionDetail>
{
  constructor(private readonly repo: RecruitmentRepository) {}
  execute({ requisitionId, criteria, actor }: SetScorecardCriteriaCommand): Promise<RequisitionDetail> {
    return this.repo.setScorecardCriteria(requisitionId, criteria, actor);
  }
}
