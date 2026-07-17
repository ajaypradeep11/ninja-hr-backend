import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ToolLibraryRepository } from '../../infrastructure/tool-library.repository';

export class SetToolGrantsCommand {
  constructor(
    public readonly slug: string,
    public readonly userIds: string[],
  ) {}
}

@CommandHandler(SetToolGrantsCommand)
export class SetToolGrantsHandler implements ICommandHandler<SetToolGrantsCommand> {
  constructor(private readonly repo: ToolLibraryRepository) {}

  async execute(command: SetToolGrantsCommand): Promise<{ slug: string; grantedUserIds: string[] }> {
    const tool = await this.repo.getToolBySlug(command.slug);
    if (!tool) throw new NotFoundException(`Unknown tool "${command.slug}".`);
    await this.repo.setGrants(tool.id, command.userIds);
    return { slug: tool.slug, grantedUserIds: await this.repo.getGrantedUserIds(tool.id) };
  }
}
