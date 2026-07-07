// src/contexts/recruitment/application/commands/guide-template.commands.ts
// Company standard interview guide: read, replace, and import-from-document.
import { CommandHandler, ICommandHandler, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { RecruitmentRepository } from '../../infrastructure/recruitment.repository';
import { GuideImporterService, type GuideImportResult } from '../../infrastructure/guide-importer.service';
import type { ActorContext } from 'src/platform/auth/actor-context';
import type { GuideSectionInput } from '../../domain/recruitment.types';

export class GetGuideTemplateQuery {}

@QueryHandler(GetGuideTemplateQuery)
export class GetGuideTemplateHandler implements IQueryHandler<GetGuideTemplateQuery, GuideSectionInput[]> {
  constructor(private readonly repo: RecruitmentRepository) {}
  execute(): Promise<GuideSectionInput[]> {
    return this.repo.getGuideTemplate();
  }
}

export class SetGuideTemplateCommand {
  constructor(public readonly sections: GuideSectionInput[], public readonly actor: ActorContext) {}
}

@CommandHandler(SetGuideTemplateCommand)
export class SetGuideTemplateHandler implements ICommandHandler<SetGuideTemplateCommand, GuideSectionInput[]> {
  constructor(private readonly repo: RecruitmentRepository) {}
  execute({ sections, actor }: SetGuideTemplateCommand): Promise<GuideSectionInput[]> {
    return this.repo.setGuideTemplate(sections, actor);
  }
}

export class ImportGuideCommand {
  constructor(public readonly text: string) {}
}

@CommandHandler(ImportGuideCommand)
export class ImportGuideHandler implements ICommandHandler<ImportGuideCommand, GuideImportResult> {
  constructor(private readonly importer: GuideImporterService) {}
  execute({ text }: ImportGuideCommand): Promise<GuideImportResult> {
    // Parses only — nothing is saved until the admin reviews and clicks Save.
    return this.importer.import(text);
  }
}
