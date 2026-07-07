// src/contexts/recruitment/application/commands/update-requisition.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RecruitmentRepository, type CreateRequisitionInput } from '../../infrastructure/recruitment.repository';
import type { ActorContext } from 'src/platform/auth/actor-context';
import type { RequisitionDetail } from '../../domain/recruitment.types';

export class UpdateRequisitionCommand {
  constructor(
    public readonly id: string,
    public readonly input: CreateRequisitionInput,
    public readonly actor: ActorContext,
  ) {}
}

@CommandHandler(UpdateRequisitionCommand)
export class UpdateRequisitionHandler
  implements ICommandHandler<UpdateRequisitionCommand, RequisitionDetail>
{
  constructor(private readonly repo: RecruitmentRepository) {}
  execute({ id, input, actor }: UpdateRequisitionCommand): Promise<RequisitionDetail> {
    return this.repo.updateRequisition(id, input, actor);
  }
}
