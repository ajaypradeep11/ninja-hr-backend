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

export class DeleteVaultDocumentCommand {
  constructor(public readonly id: string) {}
}

@CommandHandler(DeleteVaultDocumentCommand)
export class DeleteVaultDocumentHandler implements ICommandHandler<DeleteVaultDocumentCommand> {
  constructor(private readonly repo: WorkplaceRepository) {}
  async execute({ id }: DeleteVaultDocumentCommand): Promise<{ ok: true }> {
    await this.repo.removeVaultDocument(id);
    return { ok: true };
  }
}
