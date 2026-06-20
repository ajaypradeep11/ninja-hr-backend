import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';

export class GetPipelineQuery {}

@QueryHandler(GetPipelineQuery)
export class GetPipelineHandler implements IQueryHandler<GetPipelineQuery> {
  constructor(private readonly repo: OnboardingRepository) {}
  execute() {
    return this.repo.pipeline();
  }
}
