// src/contexts/onboarding/application/commands/activate.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';
import type { OnboardingCase } from '../../domain/onboarding.types';

export class ActivateCommand {
  constructor(public readonly id: string) {}
}

@CommandHandler(ActivateCommand)
export class ActivateHandler implements ICommandHandler<ActivateCommand, OnboardingCase | null> {
  constructor(private readonly repo: OnboardingRepository) {}
  async execute({ id }: ActivateCommand): Promise<OnboardingCase | null> {
    await this.repo.setStatus(id, 'Active');
    await this.repo.addAudit(id, 'Account activated — payroll set to Active, SSO provisioned');
    return this.repo.findById(id);
  }
}
