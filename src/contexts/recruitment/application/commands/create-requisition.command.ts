// src/contexts/recruitment/application/commands/create-requisition.command.ts
import { ForbiddenException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RecruitmentRepository, type CreateRequisitionInput } from '../../infrastructure/recruitment.repository';
import type { ActorContext } from 'src/platform/auth/actor-context';
import type { RequisitionDetail } from '../../domain/recruitment.types';

export class CreateRequisitionCommand {
  constructor(public readonly input: CreateRequisitionInput, public readonly actor: ActorContext) {}
}

@CommandHandler(CreateRequisitionCommand)
export class CreateRequisitionHandler
  implements ICommandHandler<CreateRequisitionCommand, RequisitionDetail>
{
  constructor(private readonly repo: RecruitmentRepository) {}

  execute({ input, actor }: CreateRequisitionCommand): Promise<RequisitionDetail> {
    // Managers may only open requisitions for their own department; HR is unrestricted.
    if (actor.role === 'MANAGER' && actor.department && input.department !== actor.department) {
      throw new ForbiddenException(`Managers can only open requisitions for their own department (${actor.department})`);
    }
    return this.repo.createRequisition(input, actor);
  }
}
