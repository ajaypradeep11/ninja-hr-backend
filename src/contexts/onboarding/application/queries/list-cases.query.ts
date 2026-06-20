import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';
import type { OnboardingCase } from '../../domain/onboarding.types';

export class ListCasesQuery {}

@QueryHandler(ListCasesQuery)
export class ListCasesHandler implements IQueryHandler<ListCasesQuery, OnboardingCase[]> {
  constructor(private readonly repo: OnboardingRepository) {}
  execute(): Promise<OnboardingCase[]> {
    return this.repo.list();
  }
}
