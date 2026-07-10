// src/contexts/workplace/application/queries/get-vault-documents.query.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { WorkplaceRepository } from '../../infrastructure/workplace.repository';
import type { VaultDocument } from '../../domain/workplace.types';
import type { ActorContext } from 'src/platform/auth/actor-context';

export class GetVaultDocumentsQuery {
  constructor(public readonly actor?: ActorContext) {}
}

@QueryHandler(GetVaultDocumentsQuery)
export class GetVaultDocumentsHandler implements IQueryHandler<GetVaultDocumentsQuery, VaultDocument[]> {
  constructor(private readonly repo: WorkplaceRepository) {}
  execute(query: GetVaultDocumentsQuery): Promise<VaultDocument[]> {
    return this.repo.getVaultDocuments(query.actor);
  }
}
