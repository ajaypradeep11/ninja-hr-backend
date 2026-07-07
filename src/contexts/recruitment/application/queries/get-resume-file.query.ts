// src/contexts/recruitment/application/queries/get-resume-file.query.ts
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { RecruitmentRepository } from '../../infrastructure/recruitment.repository';
import type { ActorContext } from 'src/platform/auth/actor-context';

export interface ResumeFile {
  fileName: string;
  mimeType: string;
  data: Buffer;
}

export class GetResumeFileQuery {
  constructor(public readonly candidateId: string, public readonly actor: ActorContext) {}
}

@QueryHandler(GetResumeFileQuery)
export class GetResumeFileHandler implements IQueryHandler<GetResumeFileQuery, ResumeFile> {
  constructor(private readonly repo: RecruitmentRepository) {}
  async execute({ candidateId, actor }: GetResumeFileQuery): Promise<ResumeFile> {
    await this.repo.assertCandidateAccess(candidateId, actor); // HR, hiring manager or team
    // Blind Hiring: the résumé file is identifying — refuse it at the API for
    // non-HR viewers while the requisition is blind (the UI also hides it, but
    // the server is the enforcement point).
    if (actor.role !== 'HR_ADMIN' && (await this.repo.isCandidateBlindForViewer(candidateId))) {
      throw new ForbiddenException('Résumé file is hidden while Blind Hiring is on');
    }
    const file = await this.repo.getResumeFile(candidateId);
    if (!file) throw new NotFoundException('No résumé on file for this candidate');
    return file;
  }
}
