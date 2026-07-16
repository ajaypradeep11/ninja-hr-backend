import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { PolicyDocumentSummary } from '../../domain/policy.types';
import { PolicyRepository } from '../../infrastructure/policy.repository';

export class GetPolicyDocumentsQuery {}

@QueryHandler(GetPolicyDocumentsQuery)
export class GetPolicyDocumentsHandler implements IQueryHandler<
  GetPolicyDocumentsQuery,
  PolicyDocumentSummary[]
> {
  constructor(private readonly repo: PolicyRepository) {}

  execute(): Promise<PolicyDocumentSummary[]> {
    return this.repo.listDocuments();
  }
}
