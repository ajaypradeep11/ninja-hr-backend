// Persistence for the Tool Library. The AiTool catalog is GLOBAL (no
// companyId) and therefore read through the raw system client; per-tenant
// state (CompanyToolSetting, ToolGrant) goes through TenantPrismaService so
// every row is automatically scoped to the caller's company.

import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/platform/database/prisma.service';
import { TenantPrismaService } from 'src/platform/database/tenant-prisma.service';

export interface ToolRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  kind: 'PROMPT' | 'BUILTIN';
  inputs: unknown;
  surfaces: string[];
  href: string | null;
  sortOrder: number;
}

export interface GrantableUser {
  userId: string;
  employeeId: string;
  name: string;
  title: string;
  department: string;
  role: string;
}

@Injectable()
export class ToolLibraryRepository {
  constructor(
    private readonly system: PrismaService,
    private readonly tenant: TenantPrismaService,
  ) {}

  /* ------------------------------ Catalog ------------------------------ */

  async listTools(): Promise<ToolRow[]> {
    const rows = await this.system.aiTool.findMany({ orderBy: { sortOrder: 'asc' } });
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      category: r.category,
      description: r.description,
      kind: r.kind,
      inputs: r.inputs,
      surfaces: r.surfaces,
      href: r.href,
      sortOrder: r.sortOrder,
    }));
  }

  async getToolBySlug(slug: string): Promise<{ id: string; slug: string } | null> {
    return this.system.aiTool.findUnique({ where: { slug }, select: { id: true, slug: true } });
  }

  /* ------------------------ Company-wide toggles ------------------------ */

  /** toolId → enabled for the caller's company. Tools without a row are enabled. */
  async getCompanySettings(): Promise<Map<string, boolean>> {
    const rows = await this.tenant.companyToolSetting.findMany({});
    return new Map(rows.map((r) => [r.toolId, r.enabled]));
  }

  async setEnabled(toolId: string, enabled: boolean): Promise<void> {
    // Get-or-create keyed by tenant context (same pattern as CompanySettings):
    // upsert's unique `where` can't be expressed from ALS context alone.
    const existing = await this.tenant.companyToolSetting.findFirst({ where: { toolId } });
    if (existing) {
      await this.tenant.companyToolSetting.update({
        where: { id: existing.id },
        data: { enabled },
      });
    } else {
      await this.tenant.companyToolSetting.create({ data: { toolId, enabled } });
    }
  }

  /* --------------------------- Per-user grants --------------------------- */

  async getGrantedUserIds(toolId: string): Promise<string[]> {
    const rows = await this.tenant.toolGrant.findMany({
      where: { toolId },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }

  /** All tool ids granted to one user (for non-admin library listings). */
  async getGrantedToolIds(userId: string): Promise<Set<string>> {
    const rows = await this.tenant.toolGrant.findMany({
      where: { userId },
      select: { toolId: true },
    });
    return new Set(rows.map((r) => r.toolId));
  }

  async hasGrant(toolId: string, userId: string): Promise<boolean> {
    const row = await this.tenant.toolGrant.findFirst({
      where: { toolId, userId },
      select: { id: true },
    });
    return row !== null;
  }

  /** Replace the grant list for a tool. Only same-company users can be granted. */
  async setGrants(toolId: string, userIds: string[]): Promise<void> {
    // The tenant extension scopes this findMany, so ids from another company
    // silently drop out instead of creating cross-tenant grants.
    const valid = await this.tenant.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true },
    });
    const keep = valid.map((u) => u.id);
    await this.tenant.toolGrant.deleteMany({
      where: { toolId, userId: { notIn: keep } },
    });
    const existing = await this.tenant.toolGrant.findMany({
      where: { toolId },
      select: { userId: true },
    });
    const have = new Set(existing.map((r) => r.userId));
    const toCreate = keep.filter((id) => !have.has(id));
    if (toCreate.length > 0) {
      await this.tenant.toolGrant.createMany({
        data: toCreate.map((userId) => ({ toolId, userId })),
      });
    }
  }

  /** Non-admin users of the company (admins hold implicit full access). */
  async listGrantableUsers(): Promise<GrantableUser[]> {
    const rows = await this.tenant.user.findMany({
      where: { role: { in: ['MANAGER', 'EMPLOYEE'] } },
      include: { employee: { select: { id: true, name: true, title: true, department: true } } },
      orderBy: { employee: { name: 'asc' } },
    });
    return rows.map((u) => ({
      userId: u.id,
      employeeId: u.employee.id,
      name: u.employee.name,
      title: u.employee.title,
      department: u.employee.department,
      role: u.role,
    }));
  }
}
