import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';
import type { OnboardingCase } from '../../domain/onboarding.types';

export class GetCaseByTokenQuery {
  constructor(public readonly token: string) {}
}

/** Backs the `/welcome/:token` invite-acceptance flow — the new hire has no
 * session yet, so this is read over the trusted internal-key lane. Returns
 * null (not a 404) for an unknown/expired token; the caller decides how to
 * present that. */
@QueryHandler(GetCaseByTokenQuery)
export class GetCaseByTokenHandler implements IQueryHandler<GetCaseByTokenQuery, OnboardingCase | null> {
  constructor(private readonly repo: OnboardingRepository) {}
  execute(query: GetCaseByTokenQuery): Promise<OnboardingCase | null> {
    return this.repo.findByToken(query.token);
  }
}
