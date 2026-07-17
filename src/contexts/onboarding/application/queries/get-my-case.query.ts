import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';
import type { OnboardingCase } from '../../domain/onboarding.types';

export class GetMyCaseQuery {
  constructor(public readonly employeeId: string) {}
}

/**
 * The signed-in hire's own onboarding case, or null if they have none (which is
 * every employee who joined before onboarding existed, and everyone whose case
 * was never linked). Scoped to the caller's employeeId, so unlike the HR-only
 * `cases` list this is safe to expose to any authenticated user — it is the
 * employee shell's source of truth for "am I still onboarding?".
 */
@QueryHandler(GetMyCaseQuery)
export class GetMyCaseHandler implements IQueryHandler<GetMyCaseQuery, OnboardingCase | null> {
  constructor(private readonly repo: OnboardingRepository) {}
  execute(query: GetMyCaseQuery): Promise<OnboardingCase | null> {
    return this.repo.findByEmployeeId(query.employeeId);
  }
}
