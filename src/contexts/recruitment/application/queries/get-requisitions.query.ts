// src/contexts/recruitment/application/queries/get-requisitions.query.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { RecruitmentRepository } from '../../infrastructure/recruitment.repository';
import type { ActorContext } from 'src/platform/auth/actor-context';
import type { Requisition } from '../../domain/recruitment.types';

export class GetRequisitionsQuery {
  constructor(public readonly actor: ActorContext, public readonly includeArchived = false) {}
}

@QueryHandler(GetRequisitionsQuery)
export class GetRequisitionsHandler
  implements IQueryHandler<GetRequisitionsQuery, Requisition[]>
{
  constructor(private readonly repo: RecruitmentRepository) {}

  execute({ actor, includeArchived }: GetRequisitionsQuery): Promise<Requisition[]> {
    return this.repo.listRequisitionsForActor(actor, includeArchived);
  }
}
