// src/contexts/recruitment/application/commands/update-publishing.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RecruitmentRepository, type PublishingInput } from '../../infrastructure/recruitment.repository';
import type { ActorContext } from 'src/platform/auth/actor-context';
import type { RequisitionDetail } from '../../domain/recruitment.types';

export class UpdatePublishingCommand {
  constructor(
    public readonly id: string,
    public readonly input: PublishingInput,
    public readonly actor: ActorContext,
  ) {}
}

@CommandHandler(UpdatePublishingCommand)
export class UpdatePublishingHandler
  implements ICommandHandler<UpdatePublishingCommand, RequisitionDetail>
{
  constructor(private readonly repo: RecruitmentRepository) {}
  execute({ id, input, actor }: UpdatePublishingCommand): Promise<RequisitionDetail> {
    return this.repo.updatePublishing(id, input, actor);
  }
}
