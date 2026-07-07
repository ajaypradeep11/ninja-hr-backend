// src/contexts/onboarding/application/commands/add-consent.command.ts
import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';
import { settle } from '../onboarding.settle';
import { PRIVACY_POLICY_VERSION, type OnboardingCase } from '../../domain/onboarding.types';

export class AddConsentCommand {
  constructor(public readonly token: string, public readonly policy: string, public readonly ip?: string) {}
}

@CommandHandler(AddConsentCommand)
export class AddConsentHandler implements ICommandHandler<AddConsentCommand, OnboardingCase | null> {
  constructor(private readonly repo: OnboardingRepository) {}
  async execute({ token, policy, ip }: AddConsentCommand): Promise<OnboardingCase | null> {
    const c = await this.repo.findByToken(token);
    if (!c) throw new NotFoundException('Onboarding case not found for token');
    await this.repo.addConsentEntry(c.id, policy, PRIVACY_POLICY_VERSION, ip || 'unknown');
    return settle(this.repo, c.id);
  }
}
