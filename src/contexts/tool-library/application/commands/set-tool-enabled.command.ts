import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ToolLibraryRepository } from '../../infrastructure/tool-library.repository';

export class SetToolEnabledCommand {
  constructor(
    public readonly slug: string,
    public readonly enabled: boolean,
  ) {}
}

@CommandHandler(SetToolEnabledCommand)
export class SetToolEnabledHandler implements ICommandHandler<SetToolEnabledCommand> {
  constructor(private readonly repo: ToolLibraryRepository) {}

  async execute(command: SetToolEnabledCommand): Promise<{ slug: string; enabled: boolean }> {
    const tool = await this.repo.getToolBySlug(command.slug);
    if (!tool) throw new NotFoundException(`Unknown tool "${command.slug}".`);
    await this.repo.setEnabled(tool.id, command.enabled);
    return { slug: tool.slug, enabled: command.enabled };
  }
}
