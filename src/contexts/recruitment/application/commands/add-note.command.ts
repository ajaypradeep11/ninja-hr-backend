// src/contexts/recruitment/application/commands/add-note.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RecruitmentRepository } from '../../infrastructure/recruitment.repository';
import type { ActorContext } from 'src/platform/auth/actor-context';
import type { CandidateDetail } from '../../domain/recruitment.types';

export class AddNoteCommand {
  constructor(
    public readonly candidateId: string,
    public readonly body: string,
    public readonly actor: ActorContext,
  ) {}
}

@CommandHandler(AddNoteCommand)
export class AddNoteHandler implements ICommandHandler<AddNoteCommand, CandidateDetail> {
  constructor(private readonly repo: RecruitmentRepository) {}
  async execute({ candidateId, body, actor }: AddNoteCommand): Promise<CandidateDetail> {
    // Hiring-team or HR only — internal evaluation notes are RBAC-restricted.
    await this.repo.assertCandidateAccess(candidateId, actor);
    return this.repo.addNote(candidateId, body, actor);
  }
}
