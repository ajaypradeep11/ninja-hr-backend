// src/contexts/onboarding/application/commands/finalize-submission.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';
import { settle } from '../onboarding.settle';
import { generateSubmittedDocuments } from '../../domain/submitted-documents.service';
import type { OnboardingCase } from '../../domain/onboarding.types';

export class FinalizeSubmissionCommand {
  constructor(public readonly token: string) {}
}

@CommandHandler(FinalizeSubmissionCommand)
export class FinalizeSubmissionHandler implements ICommandHandler<FinalizeSubmissionCommand, OnboardingCase | null> {
  constructor(private readonly repo: OnboardingRepository) {}
  async execute({ token }: FinalizeSubmissionCommand): Promise<OnboardingCase | null> {
    const c = await this.repo.findByToken(token);
    if (!c) return null;
    const docs = generateSubmittedDocuments(c);
    await this.repo.replaceDocuments(c.id, docs);
    await this.repo.addAudit(c.id, 'Employee submitted onboarding wizard (webhook: onboarding.workflow.finished)');
    await this.repo.setStatus(c.id, 'Pending Verification');
    return settle(this.repo, c.id);
  }
}
