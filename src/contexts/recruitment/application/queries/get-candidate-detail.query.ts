// src/contexts/recruitment/application/queries/get-candidate-detail.query.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { RecruitmentRepository } from '../../infrastructure/recruitment.repository';
import type { ActorContext } from 'src/platform/auth/actor-context';
import type { CandidateDetail } from '../../domain/recruitment.types';

export class GetCandidateDetailQuery {
  constructor(public readonly id: string, public readonly actor: ActorContext) {}
}

@QueryHandler(GetCandidateDetailQuery)
export class GetCandidateDetailHandler
  implements IQueryHandler<GetCandidateDetailQuery, CandidateDetail>
{
  constructor(private readonly repo: RecruitmentRepository) {}
  async execute({ id, actor }: GetCandidateDetailQuery): Promise<CandidateDetail> {
    await this.repo.assertCandidateAccess(id, actor);
    return this.repo.getCandidateDetail(id, actor);
  }
}
