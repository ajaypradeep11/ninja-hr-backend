// src/contexts/onboarding/application/commands/toggle-policy.command.ts
import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';
import { settle } from '../onboarding.settle';
import type { OnboardingCase } from '../../domain/onboarding.types';

export class TogglePolicyCommand {
  constructor(public readonly id: string, public readonly policy: string) {}
}

@CommandHandler(TogglePolicyCommand)
export class TogglePolicyHandler implements ICommandHandler<TogglePolicyCommand, OnboardingCase | null> {
  constructor(private readonly repo: OnboardingRepository) {}
  async execute({ id, policy }: TogglePolicyCommand): Promise<OnboardingCase | null> {
    const c = await this.repo.findById(id);
    if (!c) throw new NotFoundException(`Onboarding case ${id} not found`);
    const policiesAttached = c.policiesAttached.includes(policy)
      ? c.policiesAttached.filter((p) => p !== policy)
      : [...c.policiesAttached, policy];
    await this.repo.setPolicies(id, policiesAttached);
    return settle(this.repo, id);
  }
}
