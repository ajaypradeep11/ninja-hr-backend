import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { PolicyDocumentSummary } from '../../domain/policy.types';
import { PolicyRepository } from '../../infrastructure/policy.repository';

export class DeletePolicyDocumentCommand {
  constructor(public readonly id: string) {}
}

@CommandHandler(DeletePolicyDocumentCommand)
export class DeletePolicyDocumentHandler implements ICommandHandler<
  DeletePolicyDocumentCommand,
  PolicyDocumentSummary[]
> {
  constructor(private readonly repo: PolicyRepository) {}

  async execute({ id }: DeletePolicyDocumentCommand): Promise<PolicyDocumentSummary[]> {
    const document = await this.repo.getDocument(id);
    if (!document) throw new NotFoundException('Policy document not found');
    await this.repo.deleteDocument(id);
    return this.repo.listDocuments();
  }
}
