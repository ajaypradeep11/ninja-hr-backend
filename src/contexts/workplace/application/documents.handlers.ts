// src/contexts/workplace/application/documents.handlers.ts
// Document vault: manual uploads from the Documents module dropzone.
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { UploadVaultDocumentInput } from '../domain/workplace.types';
import { WorkplaceRepository } from '../infrastructure/workplace.repository';

export class UploadVaultDocumentCommand {
  constructor(public readonly input: UploadVaultDocumentInput) {}
}

@CommandHandler(UploadVaultDocumentCommand)
export class UploadVaultDocumentHandler implements ICommandHandler<UploadVaultDocumentCommand> {
  constructor(private readonly repo: WorkplaceRepository) {}
  execute(c: UploadVaultDocumentCommand) {
    return this.repo.addVaultDocument(c.input);
  }
}
