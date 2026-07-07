// src/contexts/recruitment/application/commands/delete-requisition.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RecruitmentRepository } from '../../infrastructure/recruitment.repository';
import type { ActorContext } from 'src/platform/auth/actor-context';
import type { Requisition } from '../../domain/recruitment.types';

export class DeleteRequisitionCommand {
  constructor(public readonly id: string, public readonly actor: ActorContext) {}
}

@CommandHandler(DeleteRequisitionCommand)
export class DeleteRequisitionHandler
  implements ICommandHandler<DeleteRequisitionCommand, Requisition[]>
{
  constructor(private readonly repo: RecruitmentRepository) {}
  execute({ id, actor }: DeleteRequisitionCommand): Promise<Requisition[]> {
    return this.repo.deleteRequisition(id, actor);
  }
}
