// src/contexts/recruitment/application/queries/get-analytics.query.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { RecruitmentRepository } from '../../infrastructure/recruitment.repository';
import type { RecruitmentAnalytics } from '../../domain/recruitment.types';

export class GetAnalyticsQuery {}

@QueryHandler(GetAnalyticsQuery)
export class GetAnalyticsHandler implements IQueryHandler<GetAnalyticsQuery, RecruitmentAnalytics> {
  constructor(private readonly repo: RecruitmentRepository) {}
  execute(): Promise<RecruitmentAnalytics> {
    return this.repo.getAnalytics();
  }
}
