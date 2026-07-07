// src/contexts/recruitment/application/commands/template-crud.commands.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RecruitmentRepository } from '../../infrastructure/recruitment.repository';
import type { CommunicationTemplateEntry } from '../../domain/recruitment.types';

type TriggerLabel = 'Application Received' | 'Interview Scheduled' | 'Rejected' | 'Manual';

export class CreateTemplateCommand {
  constructor(
    public readonly input: { name: string; subject: string; body: string; trigger: TriggerLabel },
  ) {}
}

@CommandHandler(CreateTemplateCommand)
export class CreateTemplateHandler
  implements ICommandHandler<CreateTemplateCommand, CommunicationTemplateEntry[]>
{
  constructor(private readonly repo: RecruitmentRepository) {}
  execute({ input }: CreateTemplateCommand): Promise<CommunicationTemplateEntry[]> {
    return this.repo.createTemplate(input);
  }
}

export class UpdateTemplateCommand {
  constructor(
    public readonly id: string,
    public readonly input: { name?: string; subject?: string; body?: string; trigger?: TriggerLabel },
  ) {}
}

@CommandHandler(UpdateTemplateCommand)
export class UpdateTemplateHandler
  implements ICommandHandler<UpdateTemplateCommand, CommunicationTemplateEntry[]>
{
  constructor(private readonly repo: RecruitmentRepository) {}
  execute({ id, input }: UpdateTemplateCommand): Promise<CommunicationTemplateEntry[]> {
    return this.repo.updateTemplate(id, input);
  }
}

export class DeleteTemplateCommand {
  constructor(public readonly id: string) {}
}

@CommandHandler(DeleteTemplateCommand)
export class DeleteTemplateHandler
  implements ICommandHandler<DeleteTemplateCommand, CommunicationTemplateEntry[]>
{
  constructor(private readonly repo: RecruitmentRepository) {}
  execute({ id }: DeleteTemplateCommand): Promise<CommunicationTemplateEntry[]> {
    return this.repo.deleteTemplate(id);
  }
}
