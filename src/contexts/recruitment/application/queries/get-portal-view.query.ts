// src/contexts/recruitment/application/queries/get-portal-view.query.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { RecruitmentRepository } from '../../infrastructure/recruitment.repository';
import type { PortalView } from '../../domain/recruitment.types';

export class GetPortalViewQuery {
  constructor(public readonly token: string) {}
}

@QueryHandler(GetPortalViewQuery)
export class GetPortalViewHandler implements IQueryHandler<GetPortalViewQuery, PortalView> {
  constructor(private readonly repo: RecruitmentRepository) {}
  execute({ token }: GetPortalViewQuery): Promise<PortalView> {
    return this.repo.getPortalView(token);
  }
}
