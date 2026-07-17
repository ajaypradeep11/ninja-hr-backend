import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { ActorContext } from 'src/platform/auth/actor-context';
import { canManageLibrary, canRunTool, canSeeTool } from '../../domain/tool-access';
import { ToolLibraryRepository } from '../../infrastructure/tool-library.repository';

export class ListToolsQuery {
  constructor(
    public readonly actor: ActorContext,
    public readonly surface?: string,
  ) {}
}

export interface ToolListItem {
  slug: string;
  name: string;
  category: string;
  description: string;
  kind: 'PROMPT' | 'BUILTIN';
  inputs: unknown;
  surfaces: string[];
  href: string | null;
  /** Company-wide switch (Super Admin controlled). */
  enabled: boolean;
  /** Whether THIS caller may run/open the tool right now. */
  canRun: boolean;
  /** Whether this caller holds an individual grant (admins: implicit). */
  granted: boolean;
  /** Number of users individually granted access (admins only, else 0). */
  grantCount: number;
}

export interface ToolLibraryView {
  canManage: boolean;
  tools: ToolListItem[];
}

@QueryHandler(ListToolsQuery)
export class ListToolsHandler implements IQueryHandler<ListToolsQuery> {
  constructor(private readonly repo: ToolLibraryRepository) {}

  async execute(query: ListToolsQuery): Promise<ToolLibraryView> {
    const { actor, surface } = query;
    const manage = canManageLibrary(actor.role);

    const [tools, settings] = await Promise.all([
      this.repo.listTools(),
      this.repo.getCompanySettings(),
    ]);
    const grantedIds = actor.userId
      ? await this.repo.getGrantedToolIds(actor.userId)
      : new Set<string>();

    // Grant counts only matter for the admin management view; one query total.
    const grantCounts = new Map<string, number>();
    if (manage) {
      for (const tool of tools) {
        grantCounts.set(tool.id, (await this.repo.getGrantedUserIds(tool.id)).length);
      }
    }

    const items: ToolListItem[] = [];
    for (const tool of tools) {
      const enabled = settings.get(tool.id) ?? true;
      const granted = grantedIds.has(tool.id);
      if (!canSeeTool(actor.role, enabled, granted)) continue;
      if (surface && !tool.surfaces.includes(surface)) continue;
      // BUILTIN tools live inside the HR admin console; non-admin listings
      // only carry runnable PROMPT tools.
      if (tool.kind === 'BUILTIN' && !manage) continue;
      items.push({
        slug: tool.slug,
        name: tool.name,
        category: tool.category,
        description: tool.description,
        kind: tool.kind,
        inputs: tool.inputs,
        surfaces: tool.surfaces,
        href: tool.href,
        enabled,
        canRun: canRunTool(actor.role, enabled, granted),
        granted,
        grantCount: grantCounts.get(tool.id) ?? 0,
      });
    }
    return { canManage: manage, tools: items };
  }
}
