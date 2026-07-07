// src/contexts/workplace/application/letters.handlers.ts
// Letter Lab: HR document templates + issuing generated letters to the vault.
import { CommandHandler, ICommandHandler, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { IssueLetterInput, LetterTemplateInput } from '../domain/workplace.types';
import { WorkplaceRepository } from '../infrastructure/workplace.repository';

/* ------------------------------ Queries ------------------------------ */

export class GetLetterTemplatesQuery {}

@QueryHandler(GetLetterTemplatesQuery)
export class GetLetterTemplatesHandler implements IQueryHandler<GetLetterTemplatesQuery> {
  constructor(private readonly repo: WorkplaceRepository) {}
  execute() {
    return this.repo.getLetterTemplates();
  }
}

/* ------------------------------ Commands ----------------------------- */

export class CreateLetterTemplateCommand {
  constructor(public readonly input: LetterTemplateInput) {}
}

@CommandHandler(CreateLetterTemplateCommand)
export class CreateLetterTemplateHandler implements ICommandHandler<CreateLetterTemplateCommand> {
  constructor(private readonly repo: WorkplaceRepository) {}
  execute(c: CreateLetterTemplateCommand) {
    return this.repo.createLetterTemplate(c.input);
  }
}

export class UpdateLetterTemplateCommand {
  constructor(
    public readonly id: string,
    public readonly input: Partial<LetterTemplateInput>,
  ) {}
}

@CommandHandler(UpdateLetterTemplateCommand)
export class UpdateLetterTemplateHandler implements ICommandHandler<UpdateLetterTemplateCommand> {
  constructor(private readonly repo: WorkplaceRepository) {}
  execute(c: UpdateLetterTemplateCommand) {
    return this.repo.updateLetterTemplate(c.id, c.input);
  }
}

export class DeleteLetterTemplateCommand {
  constructor(public readonly id: string) {}
}

@CommandHandler(DeleteLetterTemplateCommand)
export class DeleteLetterTemplateHandler implements ICommandHandler<DeleteLetterTemplateCommand> {
  constructor(private readonly repo: WorkplaceRepository) {}
  execute(c: DeleteLetterTemplateCommand) {
    return this.repo.deleteLetterTemplate(c.id);
  }
}

export class IssueLetterCommand {
  constructor(public readonly input: IssueLetterInput) {}
}

@CommandHandler(IssueLetterCommand)
export class IssueLetterHandler implements ICommandHandler<IssueLetterCommand> {
  constructor(private readonly repo: WorkplaceRepository) {}
  execute(c: IssueLetterCommand) {
    return this.repo.issueLetter(c.input);
  }
}
