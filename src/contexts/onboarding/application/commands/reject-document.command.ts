// src/contexts/onboarding/application/commands/reject-document.command.ts
import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';
import { settle } from '../onboarding.settle';
import type { OnboardingCase } from '../../domain/onboarding.types';

/**
 * HR rejects a submitted document with a note (e.g. wrong form, unsigned).
 * The schema has no REJECTED status or note column (frozen this round), so the
 * doc is parked as 'Pending' — the "rejected, awaiting re-upload" state: it
 * still blocks activation, the employee portal shows it as rejected, and the
 * note lands in the immutable audit trail. A re-upload of the same kind
 * replaces the document and returns it to 'Needs Verification'.
 */
export class RejectDocumentCommand {
  constructor(public readonly id: string, public readonly docId: string, public readonly note: string) {}
}

@CommandHandler(RejectDocumentCommand)
export class RejectDocumentHandler implements ICommandHandler<RejectDocumentCommand, OnboardingCase | null> {
  constructor(private readonly repo: OnboardingRepository) {}
  async execute({ id, docId, note }: RejectDocumentCommand): Promise<OnboardingCase | null> {
    const docName = await this.repo.rejectDocument(id, docId);
    if (!docName) throw new NotFoundException(`Document ${docId} not found on case ${id}`);
    await this.repo.addAudit(id, `HR rejected document "${docName}" — ${note}`);
    return settle(this.repo, id);
  }
}
