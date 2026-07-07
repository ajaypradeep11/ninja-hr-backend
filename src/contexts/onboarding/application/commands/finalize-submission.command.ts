// src/contexts/onboarding/application/commands/finalize-submission.command.ts
import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';
import { settle } from '../onboarding.settle';
import { generateSubmittedDocuments } from '../../domain/submitted-documents.service';
import type { OnboardingCase } from '../../domain/onboarding.types';

export class FinalizeSubmissionCommand {
  constructor(public readonly token: string, public readonly ip?: string) {}
}

@CommandHandler(FinalizeSubmissionCommand)
export class FinalizeSubmissionHandler implements ICommandHandler<FinalizeSubmissionCommand, OnboardingCase | null> {
  constructor(private readonly repo: OnboardingRepository) {}
  async execute({ token, ip }: FinalizeSubmissionCommand): Promise<OnboardingCase | null> {
    const c = await this.repo.findByToken(token);
    if (!c) throw new NotFoundException('Onboarding case not found for token');
    // Idempotent: once submitted (or activated), a replay must not regenerate
    // documents — that would wipe HR verification and demote the case.
    if (c.status !== 'Invited' && c.status !== 'Forms In Progress') return c;
    const docs = generateSubmittedDocuments(c, ip);
    await this.repo.replaceDocuments(c.id, docs);
    await this.repo.addAudit(c.id, 'Employee submitted onboarding wizard (webhook: onboarding.workflow.finished)');
    await this.repo.setStatus(c.id, 'Pending Verification');
    return settle(this.repo, c.id);
  }
}
