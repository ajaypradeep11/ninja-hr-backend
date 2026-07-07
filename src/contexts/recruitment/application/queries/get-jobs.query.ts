// src/contexts/recruitment/application/queries/get-jobs.query.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { RecruitmentRepository } from '../../infrastructure/recruitment.repository';
import type { JobPosting } from '../../domain/recruitment.types';

export class GetJobsQuery {}

@QueryHandler(GetJobsQuery)
export class GetJobsHandler implements IQueryHandler<GetJobsQuery, JobPosting[]> {
  constructor(private readonly repo: RecruitmentRepository) {}
  execute(): Promise<JobPosting[]> {
    return this.repo.listPublishedJobs();
  }
}
