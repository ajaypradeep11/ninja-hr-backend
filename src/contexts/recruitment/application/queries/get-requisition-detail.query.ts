// src/contexts/recruitment/application/queries/get-requisition-detail.query.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { RecruitmentRepository } from '../../infrastructure/recruitment.repository';
import type { ActorContext } from 'src/platform/auth/actor-context';
import type { RequisitionDetail } from '../../domain/recruitment.types';

export class GetRequisitionDetailQuery {
  constructor(public readonly id: string, public readonly actor: ActorContext) {}
}

@QueryHandler(GetRequisitionDetailQuery)
export class GetRequisitionDetailHandler
  implements IQueryHandler<GetRequisitionDetailQuery, RequisitionDetail>
{
  constructor(private readonly repo: RecruitmentRepository) {}

  async execute({ id, actor }: GetRequisitionDetailQuery): Promise<RequisitionDetail> {
    const detail = await this.repo.getDetail(id);
    this.repo.assertCanView(detail, actor);
    return detail;
  }
}
