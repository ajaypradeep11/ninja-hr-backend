// src/contexts/onboarding/application/commands/verify-document.command.ts
import { NotFoundException } from '@nestjs/common';
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
    const updated = await this.repo.verifyDocument(id, docId);
    if (!updated) throw new NotFoundException(`Document ${docId} not found on case ${id}`);
    await this.repo.addAudit(id, `HR verified document ${docId}`);
    return settle(this.repo, id);
  }
}
