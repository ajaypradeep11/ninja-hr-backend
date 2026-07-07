// src/contexts/recruitment/application/commands/purge-candidate.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RecruitmentRepository } from '../../infrastructure/recruitment.repository';
import type { ActorContext } from 'src/platform/auth/actor-context';
import type { CandidateDetail } from '../../domain/recruitment.types';

export class PurgeCandidateCommand {
  constructor(public readonly candidateId: string, public readonly actor: ActorContext) {}
}

@CommandHandler(PurgeCandidateCommand)
export class PurgeCandidateHandler
  implements ICommandHandler<PurgeCandidateCommand, CandidateDetail>
{
  constructor(private readonly repo: RecruitmentRepository) {}
  execute({ candidateId, actor }: PurgeCandidateCommand): Promise<CandidateDetail> {
    return this.repo.purgeCandidate(candidateId, actor);
  }
}
