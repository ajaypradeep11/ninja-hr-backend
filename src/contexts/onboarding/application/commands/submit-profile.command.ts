// src/contexts/onboarding/application/commands/submit-profile.command.ts
// The standard new-hire form (Ontario): personal details, SIN, address,
// emergency contact, work eligibility and direct deposit. Stored on the case;
// every read masks SIN/banking in the mapper. Submitting also ticks the
// `personal` + `directDeposit` form flags — the data covers both.
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';
import { settle } from '../onboarding.settle';
import type { NewHireProfile, OnboardingCase } from '../../domain/onboarding.types';

/**
 * What the wire may send. SIN / bank account are optional HERE only — omitted
 * means "keep the value already on file", which is what lets someone re-submit
 * without retyping secrets they can never read back (reads mask them). What
 * gets STORED always carries both; see withSecretsOnFile.
 */
export type NewHireProfileInput = Omit<NewHireProfile, 'submittedAt' | 'sin' | 'bankAccount'> & {
  sin?: string;
  bankAccount?: string;
};

/** The resolved profile — secrets settled, ready to persist. */
type StoredProfileInput = Omit<NewHireProfile, 'submittedAt'>;

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
    await this.repo.saveProfile(token, {
      ...(await this.withSecretsOnFile(token, input)),
      submittedAt: new Date().toISOString(),
    });
    await this.repo.updateForms(token, { ...c.forms, personal: true, directDeposit: true });
    // The Employee row already exists (invite acceptance created it, before any
    // of this was filled in) — push the real values onto it now, or HR's record
    // keeps the placeholders forever.
    await this.repo.syncEmployeeFromProfile(c.id);
    await this.repo.addAudit(c.id, 'New hire form submitted');
    return settle(this.repo, c.id);
  }

  /**
   * Carry SIN / bank account forward when the caller didn't re-type them.
   *
   * Reads mask both, so a returning employee (reviewing their answers, or
   * re-submitting after HR rejected a document) has no way to send them back —
   * requiring them would mean retyping a SIN to fix an unrelated typo. Omitted
   * now means "keep what's on file"; a value that IS sent is a deliberate
   * change and replaces it (the DTO's digits-only rule already bounces a mask,
   * so the placeholder can never be stored as the real thing).
   */
  private async withSecretsOnFile(token: string, input: NewHireProfileInput): Promise<StoredProfileInput> {
    const onFile = await this.repo.rawProfile(token);
    const keep = (sent: string | undefined, stored: unknown): string | undefined =>
      sent ?? (typeof stored === 'string' && stored ? stored : undefined);

    const sin = keep(input.sin, onFile?.sin);
    const bankAccount = keep(input.bankAccount, onFile?.bankAccount);
    // First submission: nothing on file to fall back to, so they're required.
    if (!sin) throw new BadRequestException('SIN is required');
    if (!bankAccount) throw new BadRequestException('Bank account number is required');
    return { ...input, sin, bankAccount };
  }
}
