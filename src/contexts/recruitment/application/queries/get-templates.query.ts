// src/contexts/recruitment/application/queries/get-templates.query.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { RecruitmentRepository } from '../../infrastructure/recruitment.repository';
import type { CommunicationTemplateEntry } from '../../domain/recruitment.types';

export class GetTemplatesQuery {}

@QueryHandler(GetTemplatesQuery)
export class GetTemplatesHandler
  implements IQueryHandler<GetTemplatesQuery, CommunicationTemplateEntry[]>
{
  constructor(private readonly repo: RecruitmentRepository) {}
  execute(): Promise<CommunicationTemplateEntry[]> {
    return this.repo.listTemplates();
  }
}
