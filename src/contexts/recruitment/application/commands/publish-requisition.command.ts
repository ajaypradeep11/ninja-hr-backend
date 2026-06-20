// src/contexts/recruitment/application/commands/publish-requisition.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  RecruitmentRepository,
  NewRequisitionInput,
} from '../../infrastructure/recruitment.repository';

export class PublishRequisitionCommand {
  constructor(public readonly input: NewRequisitionInput) {}
}

@CommandHandler(PublishRequisitionCommand)
export class PublishRequisitionHandler
  implements ICommandHandler<PublishRequisitionCommand, void>
{
  constructor(private readonly repo: RecruitmentRepository) {}

  execute({ input }: PublishRequisitionCommand): Promise<void> {
    return this.repo.publishRequisition(input);
  }
}
