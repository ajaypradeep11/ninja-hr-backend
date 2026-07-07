// src/contexts/onboarding/application/commands/upload-case-document.command.ts
// Preboarding uploads (TD1 / TD1ON / benefits enrollment / manual ack).
// Automated routing: every upload lands in the case's Documents under the
// 02_Onboarding_and_Tax folder as NEEDS_VERIFICATION — straight into the HR
// verification queue and the new hire's vault. Re-uploads replace.
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';
import { settle } from '../onboarding.settle';
import {
  DOCUMENTS_FOLDER,
  UPLOAD_KINDS,
  type OnboardingCase,
  type UploadKind,
} from '../../domain/onboarding.types';

const MAX_BYTES = 8 * 1024 * 1024; // matches the app-wide 8mb body limit
const ALLOWED_MIME = ['application/pdf', 'image/png', 'image/jpeg'];

export class UploadCaseDocumentCommand {
  constructor(
    public readonly token: string,
    public readonly kind: UploadKind,
    public readonly fileName: string,
    public readonly mimeType: string,
    public readonly dataBase64: string,
  ) {}
}

@CommandHandler(UploadCaseDocumentCommand)
export class UploadCaseDocumentHandler
  implements ICommandHandler<UploadCaseDocumentCommand, OnboardingCase | null>
{
  constructor(private readonly repo: OnboardingRepository) {}

  async execute({ token, kind, fileName, mimeType, dataBase64 }: UploadCaseDocumentCommand): Promise<OnboardingCase | null> {
    const meta = UPLOAD_KINDS[kind];
    if (!meta) {
      throw new BadRequestException(
        `Unknown document kind '${String(kind)}' — expected one of: ${Object.keys(UPLOAD_KINDS).join(', ')}`,
      );
    }
    if (!ALLOWED_MIME.includes(mimeType)) {
      throw new BadRequestException('Only PDF, PNG or JPEG files are accepted');
    }
    const c = await this.repo.findByToken(token);
    if (!c) throw new NotFoundException('Onboarding case not found for token');
    if (c.status === 'Active') {
      throw new ConflictException('This onboarding is already activated — send documents to HR directly');
    }

    let data: Buffer;
    try {
      data = Buffer.from(dataBase64, 'base64');
    } catch {
      throw new BadRequestException('File payload is not valid base64');
    }
    if (data.length === 0) throw new BadRequestException('Uploaded file is empty');
    if (data.length > MAX_BYTES) throw new BadRequestException('File is too large (max 8 MB)');

    // Keep the uploader's extension visible in the stored name for HR.
    const ext = /\.([A-Za-z0-9]{2,5})$/.exec(fileName)?.[1]?.toLowerCase();
    const name = ext ? `${meta.name}.${ext}` : meta.name;

    await this.repo.upsertCaseFile(c.id, {
      name,
      type: meta.type,
      folder: DOCUMENTS_FOLDER,
      signedBy: c.name,
      mimeType,
      data,
    });
    await this.repo.addAudit(c.id, `Uploaded: ${meta.name}`);
    return settle(this.repo, c.id);
  }
}
