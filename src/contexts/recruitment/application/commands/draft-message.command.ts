// src/contexts/recruitment/application/commands/draft-message.command.ts
// AI-assisted drafting: produces a subject+body for the composer. Human review
// is mandatory by construction — this never sends anything.
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RecruitmentRepository } from '../../infrastructure/recruitment.repository';
import { MessageDrafterService, type DraftResult } from '../../infrastructure/message-drafter.service';
import type { ActorContext } from 'src/platform/auth/actor-context';

export class DraftMessageCommand {
  constructor(
    public readonly candidateId: string,
    public readonly instruction: string,
    public readonly actor: ActorContext,
  ) {}
}

@CommandHandler(DraftMessageCommand)
export class DraftMessageHandler implements ICommandHandler<DraftMessageCommand, DraftResult> {
  constructor(
    private readonly repo: RecruitmentRepository,
    private readonly drafter: MessageDrafterService,
  ) {}

  async execute({ candidateId, instruction, actor }: DraftMessageCommand): Promise<DraftResult> {
    await this.repo.assertCandidateAccess(candidateId, actor);
    const detail = await this.repo.getCandidateDetail(candidateId, actor);
    return this.drafter.draft({
      instruction,
      candidateName: detail.name,
      jobTitle: detail.requisitionTitle ?? detail.role,
      company: 'NinjaHR',
    });
  }
}
