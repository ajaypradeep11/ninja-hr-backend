// src/contexts/recruitment/application/commands/archive-requisition.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RecruitmentRepository } from '../../infrastructure/recruitment.repository';
import type { ActorContext } from 'src/platform/auth/actor-context';
import type { Requisition } from '../../domain/recruitment.types';

export class ArchiveRequisitionCommand {
  constructor(
    public readonly id: string,
    public readonly archived: boolean,
    public readonly actor: ActorContext,
  ) {}
}

@CommandHandler(ArchiveRequisitionCommand)
export class ArchiveRequisitionHandler
  implements ICommandHandler<ArchiveRequisitionCommand, Requisition[]>
{
  constructor(private readonly repo: RecruitmentRepository) {}
  execute({ id, archived, actor }: ArchiveRequisitionCommand): Promise<Requisition[]> {
    return this.repo.setArchived(id, archived, actor);
  }
}
