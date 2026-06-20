// src/contexts/workplace/application/queries/get-vault-documents.query.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { WorkplaceRepository } from '../../infrastructure/workplace.repository';
import type { VaultDocument } from '../../domain/workplace.types';

export class GetVaultDocumentsQuery {}

@QueryHandler(GetVaultDocumentsQuery)
export class GetVaultDocumentsHandler implements IQueryHandler<GetVaultDocumentsQuery, VaultDocument[]> {
  constructor(private readonly repo: WorkplaceRepository) {}
  execute(): Promise<VaultDocument[]> {
    return this.repo.getVaultDocuments();
  }
}
