// src/contexts/platform/application/commands/save-settings.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PlatformRepository } from '../../infrastructure/platform.repository';
import type { CompanySettings } from '../../domain/platform.types';

export class SaveSettingsCommand {
  constructor(public readonly settings: CompanySettings) {}
}

@CommandHandler(SaveSettingsCommand)
export class SaveSettingsHandler
  implements ICommandHandler<SaveSettingsCommand, CompanySettings>
{
  constructor(private readonly repo: PlatformRepository) {}
  execute({ settings }: SaveSettingsCommand): Promise<CompanySettings> {
    return this.repo.saveSettings(settings);
  }
}
