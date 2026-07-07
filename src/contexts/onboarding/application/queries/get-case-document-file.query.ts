// src/contexts/onboarding/application/queries/get-case-document-file.query.ts
import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';

export interface CaseDocumentFile {
  name: string;
  mimeType: string;
  data: Buffer;
}

export class GetCaseDocumentFileQuery {
  constructor(public readonly caseId: string, public readonly docId: string) {}
}

@QueryHandler(GetCaseDocumentFileQuery)
export class GetCaseDocumentFileHandler
  implements IQueryHandler<GetCaseDocumentFileQuery, CaseDocumentFile>
{
  constructor(private readonly repo: OnboardingRepository) {}
  async execute({ caseId, docId }: GetCaseDocumentFileQuery): Promise<CaseDocumentFile> {
    const file = await this.repo.getCaseDocumentFile(caseId, docId);
    if (!file) throw new NotFoundException('No uploaded file for this document');
    return file;
  }
}
