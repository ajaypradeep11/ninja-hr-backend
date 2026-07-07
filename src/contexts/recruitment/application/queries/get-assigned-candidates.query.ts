// src/contexts/recruitment/application/queries/get-assigned-candidates.query.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { RecruitmentRepository } from '../../infrastructure/recruitment.repository';
import type { ActorContext } from 'src/platform/auth/actor-context';
import type { Candidate } from '../../domain/recruitment.types';

export class GetAssignedCandidatesQuery {
  constructor(public readonly actor: ActorContext) {}
}

@QueryHandler(GetAssignedCandidatesQuery)
export class GetAssignedCandidatesHandler
  implements IQueryHandler<GetAssignedCandidatesQuery, Candidate[]>
{
  constructor(private readonly repo: RecruitmentRepository) {}
  execute({ actor }: GetAssignedCandidatesQuery): Promise<Candidate[]> {
    return this.repo.getAssignedCandidates(actor);
  }
}
