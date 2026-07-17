// Boot-time sync of the code-defined tool catalog (domain/tool-catalog.ts)
// into the global AiTool table. Idempotent upsert-by-slug: prompts stay
// versioned in git and every deploy converges the DB to the catalog. Tools
// removed from the catalog are deleted (cascades clean up per-tenant state).

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from 'src/platform/database/prisma.service';
import { TOOL_CATALOG } from '../domain/tool-catalog';

@Injectable()
export class ToolCatalogSyncService implements OnModuleInit {
  private readonly logger = new Logger(ToolCatalogSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.sync();
    } catch (err) {
      // Never block boot on catalog sync (e.g. migrations not applied yet in
      // a fresh environment) — the library degrades to empty until fixed.
      this.logger.error(`Tool catalog sync failed: ${(err as Error).message}`);
    }
  }

  async sync(): Promise<void> {
    for (const tool of TOOL_CATALOG) {
      const data = {
        name: tool.name,
        category: tool.category,
        description: tool.description,
        kind: tool.kind,
        systemPrompt: tool.systemPrompt,
        inputs: tool.inputs as object[],
        surfaces: [...tool.surfaces],
        href: tool.href ?? null,
        sortOrder: tool.sortOrder,
      };
      await this.prisma.aiTool.upsert({
        where: { slug: tool.slug },
        create: { slug: tool.slug, ...data },
        update: data,
      });
    }
    const slugs = TOOL_CATALOG.map((t) => t.slug);
    const removed = await this.prisma.aiTool.deleteMany({ where: { slug: { notIn: slugs } } });
    this.logger.log(
      `Tool catalog synced: ${slugs.length} tools${removed.count ? `, ${removed.count} stale removed` : ''}.`,
    );
  }
}
