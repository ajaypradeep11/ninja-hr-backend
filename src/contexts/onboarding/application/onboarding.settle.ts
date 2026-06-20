// src/contexts/onboarding/application/onboarding.settle.ts
import type { OnboardingRepository } from '../infrastructure/onboarding.repository';
import { nextStatus } from '../domain/onboarding-status';
import type { OnboardingCase } from '../domain/onboarding.types';

export async function settle(repo: OnboardingRepository, id: string): Promise<OnboardingCase | null> {
  const app = await repo.findById(id);
  if (!app) return null;
  const ns = nextStatus(app);
  if (ns !== app.status) {
    await repo.setStatus(id, ns);
    app.status = ns;
  }
  return app;
}
