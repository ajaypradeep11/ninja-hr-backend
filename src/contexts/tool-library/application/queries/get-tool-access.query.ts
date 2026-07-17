import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ToolLibraryRepository } from '../../infrastructure/tool-library.repository';
import type { GrantableUser } from '../../infrastructure/tool-library.repository';

export class GetToolAccessQuery {
  constructor(public readonly slug: string) {}
}

export interface ToolAccessView {
  slug: string;
  grantedUserIds: string[];
  users: GrantableUser[];
}

@QueryHandler(GetToolAccessQuery)
export class GetToolAccessHandler implements IQueryHandler<GetToolAccessQuery> {
  constructor(private readonly repo: ToolLibraryRepository) {}

  async execute(query: GetToolAccessQuery): Promise<ToolAccessView> {
    const tool = await this.repo.getToolBySlug(query.slug);
    if (!tool) throw new NotFoundException(`Unknown tool "${query.slug}".`);
    const [grantedUserIds, users] = await Promise.all([
      this.repo.getGrantedUserIds(tool.id),
      this.repo.listGrantableUsers(),
    ]);
    return { slug: tool.slug, grantedUserIds, users };
  }
}
