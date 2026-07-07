// src/contexts/recruitment/application/queries/get-requisition-candidates.query.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { RecruitmentRepository } from '../../infrastructure/recruitment.repository';
import type { ActorContext } from 'src/platform/auth/actor-context';
import type { Candidate } from '../../domain/recruitment.types';

export class GetRequisitionCandidatesQuery {
  constructor(public readonly requisitionId: string, public readonly actor: ActorContext) {}
}

@QueryHandler(GetRequisitionCandidatesQuery)
export class GetRequisitionCandidatesHandler
  implements IQueryHandler<GetRequisitionCandidatesQuery, Candidate[]>
{
  constructor(private readonly repo: RecruitmentRepository) {}

  async execute({ requisitionId, actor }: GetRequisitionCandidatesQuery): Promise<Candidate[]> {
    const detail = await this.repo.getDetail(requisitionId);
    // Candidate access is limited to HR, the hiring manager and the hiring team.
    this.repo.assertOnHiringTeam(detail, actor);
    // Actor flows through so Blind Hiring can scrub names for non-HR viewers.
    return this.repo.getCandidatesForRequisition(requisitionId, actor);
  }
}
