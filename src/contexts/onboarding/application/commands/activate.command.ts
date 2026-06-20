// src/contexts/onboarding/application/commands/activate.command.ts
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';
import { CaseActivatedEvent } from '../events/case-activated.event';
import type { OnboardingCase } from '../../domain/onboarding.types';

export class ActivateCommand {
  constructor(public readonly id: string) {}
}

@CommandHandler(ActivateCommand)
export class ActivateHandler implements ICommandHandler<ActivateCommand, OnboardingCase | null> {
  constructor(private readonly repo: OnboardingRepository, private readonly events: EventBus) {}
  async execute({ id }: ActivateCommand): Promise<OnboardingCase | null> {
    await this.repo.setStatus(id, 'Active');
    this.events.publish(new CaseActivatedEvent(id));
    return this.repo.findById(id);
  }
}
