// src/contexts/recruitment/application/commands/send-communication.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RecruitmentRepository } from '../../infrastructure/recruitment.repository';
import type { ActorContext } from 'src/platform/auth/actor-context';
import type { CandidateDetail } from '../../domain/recruitment.types';

export class SendCommunicationCommand {
  constructor(
    public readonly candidateId: string,
    public readonly input: { templateId?: string; subject?: string; body?: string },
    public readonly actor: ActorContext,
  ) {}
}

@CommandHandler(SendCommunicationCommand)
export class SendCommunicationHandler
  implements ICommandHandler<SendCommunicationCommand, CandidateDetail>
{
  constructor(private readonly repo: RecruitmentRepository) {}
  async execute({ candidateId, input, actor }: SendCommunicationCommand): Promise<CandidateDetail> {
    await this.repo.assertCandidateAccess(candidateId, actor);
    return this.repo.sendManualCommunication(candidateId, input, actor);
  }
}
