// src/contexts/onboarding/application/commands/submit-profile.command.ts
// The standard new-hire form (Ontario): personal details, SIN, address,
// emergency contact, work eligibility and direct deposit. Stored on the case;
// every read masks SIN/banking in the mapper. Submitting also ticks the
// `personal` + `directDeposit` form flags — the data covers both.
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';
import { settle } from '../onboarding.settle';
import type { NewHireProfile, OnboardingCase } from '../../domain/onboarding.types';

export type NewHireProfileInput = Omit<NewHireProfile, 'submittedAt'>;

export class SubmitProfileCommand {
  constructor(public readonly token: string, public readonly input: NewHireProfileInput) {}
}

@CommandHandler(SubmitProfileCommand)
export class SubmitProfileHandler implements ICommandHandler<SubmitProfileCommand, OnboardingCase | null> {
  constructor(private readonly repo: OnboardingRepository) {}

  async execute({ token, input }: SubmitProfileCommand): Promise<OnboardingCase | null> {
    const c = await this.repo.findByToken(token);
    if (!c) throw new NotFoundException('Onboarding case not found for token');
    // Corrections are fine pre-activation; after activation the record is HRIS-owned.
    if (c.status === 'Active') {
      throw new ConflictException('This onboarding is already activated — ask HR to update your record');
    }
    await this.repo.saveProfile(token, { ...input, submittedAt: new Date().toISOString() });
    await this.repo.updateForms(token, { ...c.forms, personal: true, directDeposit: true });
    await this.repo.addAudit(c.id, 'New hire form submitted');
    return settle(this.repo, c.id);
  }
}
