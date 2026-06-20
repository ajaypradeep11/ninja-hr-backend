// src/contexts/onboarding/application/commands/verify-document.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';
import { settle } from '../onboarding.settle';
import type { OnboardingCase } from '../../domain/onboarding.types';

export class VerifyDocumentCommand {
  constructor(public readonly id: string, public readonly docId: string) {}
}

@CommandHandler(VerifyDocumentCommand)
export class VerifyDocumentHandler implements ICommandHandler<VerifyDocumentCommand, OnboardingCase | null> {
  constructor(private readonly repo: OnboardingRepository) {}
  async execute({ id, docId }: VerifyDocumentCommand): Promise<OnboardingCase | null> {
    await this.repo.verifyDocument(docId);
    await this.repo.addAudit(id, `HR verified document ${docId}`);
    return settle(this.repo, id);
  }
}
