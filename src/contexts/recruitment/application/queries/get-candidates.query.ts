// src/contexts/recruitment/application/queries/get-candidates.query.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { RecruitmentRepository } from '../../infrastructure/recruitment.repository';
import type { Candidate } from '../../domain/recruitment.types';

export class GetCandidatesQuery {}

@QueryHandler(GetCandidatesQuery)
export class GetCandidatesHandler
  implements IQueryHandler<GetCandidatesQuery, Candidate[]>
{
  constructor(private readonly repo: RecruitmentRepository) {}

  execute(): Promise<Candidate[]> {
    return this.repo.getCandidates();
  }
}
