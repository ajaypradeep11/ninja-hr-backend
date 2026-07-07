// src/contexts/onboarding/application/commands/activate.command.ts
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';
import { activationGates } from '../../domain/onboarding-status';
import type { OnboardingCase } from '../../domain/onboarding.types';

export class ActivateCommand {
  constructor(public readonly id: string) {}
}

@CommandHandler(ActivateCommand)
export class ActivateHandler implements ICommandHandler<ActivateCommand, OnboardingCase | null> {
  constructor(private readonly repo: OnboardingRepository) {}
  async execute({ id }: ActivateCommand): Promise<OnboardingCase | null> {
    const c = await this.repo.findById(id);
    if (!c) throw new NotFoundException(`Onboarding case ${id} not found`);
    if (c.status === 'Active') return c; // idempotent replay
    const failed = activationGates(c).filter((g) => !g.ok);
    if (failed.length > 0) {
      throw new ConflictException(
        `Cannot activate: ${failed.map((g) => g.label).join('; ')}`,
      );
    }
    await this.repo.setStatus(id, 'Active');
    await this.repo.addAudit(id, 'Account activated — payroll set to Active, SSO provisioned');
    return this.repo.findById(id);
  }
}
