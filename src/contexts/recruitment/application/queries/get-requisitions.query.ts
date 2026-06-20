// src/contexts/recruitment/application/queries/get-requisitions.query.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { RecruitmentRepository } from '../../infrastructure/recruitment.repository';
import type { Requisition } from '../../domain/recruitment.types';

export class GetRequisitionsQuery {}

@QueryHandler(GetRequisitionsQuery)
export class GetRequisitionsHandler
  implements IQueryHandler<GetRequisitionsQuery, Requisition[]>
{
  constructor(private readonly repo: RecruitmentRepository) {}

  execute(): Promise<Requisition[]> {
    return this.repo.getRequisitions();
  }
}
