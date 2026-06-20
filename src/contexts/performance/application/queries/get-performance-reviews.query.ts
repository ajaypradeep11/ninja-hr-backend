// src/contexts/performance/application/queries/get-performance-reviews.query.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PerformanceRepository } from '../../infrastructure/performance.repository';
import type { PerformanceReview } from '../../domain/performance.types';

export class GetPerformanceReviewsQuery {}

@QueryHandler(GetPerformanceReviewsQuery)
export class GetPerformanceReviewsHandler
  implements IQueryHandler<GetPerformanceReviewsQuery, PerformanceReview[]>
{
  constructor(private readonly repo: PerformanceRepository) {}

  execute(): Promise<PerformanceReview[]> {
    return this.repo.getReviews();
  }
}
