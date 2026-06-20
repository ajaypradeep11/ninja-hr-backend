// src/contexts/onboarding/application/events/case-activated.handler.ts
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';
import { CaseActivatedEvent } from './case-activated.event';

@EventsHandler(CaseActivatedEvent)
export class CaseActivatedHandler implements IEventHandler<CaseActivatedEvent> {
  constructor(private readonly repo: OnboardingRepository) {}
  async handle(event: CaseActivatedEvent): Promise<void> {
    await this.repo.addAudit(event.caseId, 'Account activated — payroll set to Active, SSO provisioned');
  }
}
