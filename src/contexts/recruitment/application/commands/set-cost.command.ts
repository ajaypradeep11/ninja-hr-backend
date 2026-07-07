// src/contexts/recruitment/application/commands/set-cost.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RecruitmentRepository } from '../../infrastructure/recruitment.repository';
import type { ActorContext } from 'src/platform/auth/actor-context';
import type { RequisitionDetail } from '../../domain/recruitment.types';

export class SetCostCommand {
  constructor(
    public readonly requisitionId: string,
    public readonly costOfHire: number,
    public readonly actor: ActorContext,
  ) {}
}

@CommandHandler(SetCostCommand)
export class SetCostHandler implements ICommandHandler<SetCostCommand, RequisitionDetail> {
  constructor(private readonly repo: RecruitmentRepository) {}
  execute({ requisitionId, costOfHire, actor }: SetCostCommand): Promise<RequisitionDetail> {
    return this.repo.setCostOfHire(requisitionId, costOfHire, actor);
  }
}
