// src/contexts/recruitment/application/commands/decide-requisition.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RecruitmentRepository } from '../../infrastructure/recruitment.repository';
import type { ActorContext } from 'src/platform/auth/actor-context';
import type { RequisitionDetail } from '../../domain/recruitment.types';

export class DecideRequisitionCommand {
  constructor(
    public readonly id: string,
    public readonly actor: ActorContext,
    public readonly decision: 'Approved' | 'Rejected',
    public readonly comment?: string,
  ) {}
}

@CommandHandler(DecideRequisitionCommand)
export class DecideRequisitionHandler
  implements ICommandHandler<DecideRequisitionCommand, RequisitionDetail>
{
  constructor(private readonly repo: RecruitmentRepository) {}
  execute({ id, actor, decision, comment }: DecideRequisitionCommand): Promise<RequisitionDetail> {
    return this.repo.decide(id, actor, decision, comment);
  }
}
