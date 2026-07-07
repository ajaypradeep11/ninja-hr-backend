// src/contexts/recruitment/application/commands/apply-to-job.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RecruitmentRepository } from '../../infrastructure/recruitment.repository';
import type { ApplyInput } from '../../domain/recruitment.types';

export class ApplyToJobCommand {
  constructor(public readonly slug: string, public readonly input: ApplyInput) {}
}

@CommandHandler(ApplyToJobCommand)
export class ApplyToJobHandler
  implements ICommandHandler<ApplyToJobCommand, { portalToken: string }>
{
  constructor(private readonly repo: RecruitmentRepository) {}
  execute({ slug, input }: ApplyToJobCommand): Promise<{ portalToken: string }> {
    return this.repo.apply(slug, input);
  }
}
