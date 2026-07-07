// src/contexts/recruitment/application/queries/get-job-by-slug.query.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { RecruitmentRepository } from '../../infrastructure/recruitment.repository';
import type { JobPostingDetail } from '../../domain/recruitment.types';

export class GetJobBySlugQuery {
  constructor(public readonly slug: string) {}
}

@QueryHandler(GetJobBySlugQuery)
export class GetJobBySlugHandler implements IQueryHandler<GetJobBySlugQuery, JobPostingDetail> {
  constructor(private readonly repo: RecruitmentRepository) {}
  execute({ slug }: GetJobBySlugQuery): Promise<JobPostingDetail> {
    return this.repo.getJobBySlug(slug);
  }
}
