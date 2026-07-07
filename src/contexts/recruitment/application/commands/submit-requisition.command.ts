// src/contexts/recruitment/application/commands/submit-requisition.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RecruitmentRepository } from '../../infrastructure/recruitment.repository';
import type { ActorContext } from 'src/platform/auth/actor-context';
import type { RequisitionDetail } from '../../domain/recruitment.types';

export class SubmitRequisitionCommand {
  constructor(public readonly id: string, public readonly actor: ActorContext) {}
}

@CommandHandler(SubmitRequisitionCommand)
export class SubmitRequisitionHandler
  implements ICommandHandler<SubmitRequisitionCommand, RequisitionDetail>
{
  constructor(private readonly repo: RecruitmentRepository) {}
  execute({ id, actor }: SubmitRequisitionCommand): Promise<RequisitionDetail> {
    return this.repo.submitForApproval(id, actor);
  }
}
