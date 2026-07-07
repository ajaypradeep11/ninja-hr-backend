// src/contexts/recruitment/application/commands/publish-requisition.command.ts
// The real HR publish step: Approved → Published (slug, publishedAt, job-board links).
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RecruitmentRepository } from '../../infrastructure/recruitment.repository';
import type { ActorContext } from 'src/platform/auth/actor-context';
import type { RequisitionDetail } from '../../domain/recruitment.types';

export class PublishRequisitionCommand {
  constructor(public readonly id: string, public readonly actor: ActorContext) {}
}

@CommandHandler(PublishRequisitionCommand)
export class PublishRequisitionHandler
  implements ICommandHandler<PublishRequisitionCommand, RequisitionDetail>
{
  constructor(private readonly repo: RecruitmentRepository) {}

  execute({ id, actor }: PublishRequisitionCommand): Promise<RequisitionDetail> {
    return this.repo.publish(id, actor);
  }
}
