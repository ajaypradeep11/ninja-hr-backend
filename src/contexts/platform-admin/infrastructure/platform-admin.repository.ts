import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/platform/database/prisma.service';
import { dedupeSlug, slugify } from 'src/platform/database/slug';
import {
  severityFor,
  type PlatformCompany,
  type PlatformLog,
  type PlatformMetrics,
  type PlatformOverview,
  type PlatformUser,
} from '../domain/platform-admin.types';

const RECENT_LOG_LIMIT = 6;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The control-plane read/write surface. This repository injects the RAW
 * PrismaService rather than TenantPrismaService on purpose: every query here is
 * inherently cross-tenant (list all companies, count users platform-wide), which
 * the tenant extension is designed to forbid. Per the extension's own docs, the
 * system client is the sanctioned escape hatch for cross-tenant work. That makes
 * this class privileged — the PlatformAdminGuard on the controller is what keeps
 * it reachable only by the admin console.
 */
@Injectable()
export class PlatformAdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  async companies(): Promise<PlatformCompany[]> {
    // Three groupBy roll-ups instead of per-company counts, so the query count
    // stays flat as companies grow rather than going N+1.
    const [rows, employees, users, openRoles] = await Promise.all([
      this.prisma.company.findMany({ orderBy: { createdAt: 'desc' } }),
      this.prisma.employee.groupBy({ by: ['companyId'], _count: { _all: true } }),
      this.prisma.user.groupBy({ by: ['companyId'], _count: { _all: true } }),
      this.prisma.requisition.groupBy({
        by: ['companyId'],
        where: { status: 'PUBLISHED' },
        _count: { _all: true },
      }),
    ]);

    const tally = (groups: { companyId: string | null; _count: { _all: number } }[]) =>
      new Map(groups.filter((g) => g.companyId).map((g) => [g.companyId as string, g._count._all]));
    const employeeBy = tally(employees);
    const userBy = tally(users);
    const openRoleBy = tally(openRoles);

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      createdAt: row.createdAt.toISOString(),
      employeeCount: employeeBy.get(row.id) ?? 0,
      userCount: userBy.get(row.id) ?? 0,
      openRoles: openRoleBy.get(row.id) ?? 0,
    }));
  }

  async overview(): Promise<PlatformOverview> {
    const [companies, logs, userCount, moderationLast24h] = await Promise.all([
      this.companies(),
      this.logs(RECENT_LOG_LIMIT),
      this.prisma.user.count(),
      // The only real "something went wrong" signal the schema records: inputs
      // the AI guardrails blocked in the last 24h.
      this.prisma.moderationEvent.count({ where: { createdAt: { gte: new Date(Date.now() - DAY_MS) } } }),
    ]);

    const metrics: PlatformMetrics = {
      companies: companies.length,
      users: userCount,
      // "Active" = has at least one user account; a company with none is a shell
      // that nobody can log into.
      activeCompanies: companies.filter((company) => company.userCount > 0).length,
      failures: moderationLast24h,
    };

    return { metrics, companies, recentLogs: logs };
  }

  async usersFor(companyId: string): Promise<PlatformUser[]> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) throw new NotFoundException('company not found');

    const rows = await this.prisma.user.findMany({
      where: { companyId },
      include: { employee: true },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((row) => ({
      id: row.id,
      employeeId: row.employeeId,
      name: row.employee.name,
      email: row.employee.email,
      title: row.employee.title,
      department: row.employee.department,
      role: row.role,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async logs(limit: number): Promise<PlatformLog[]> {
    // Two independent tables with no shared ordering key, so each is capped at
    // `limit` and the merged feed re-sorted and re-capped — the newest `limit`
    // rows overall are guaranteed to be within the union of the two.
    const [audits, moderations] = await Promise.all([
      this.prisma.auditEntry.findMany({
        take: limit,
        orderBy: { at: 'desc' },
        include: { company: { select: { name: true } } },
      }),
      this.prisma.moderationEvent.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { company: { select: { name: true } } },
      }),
    ]);

    const merged: PlatformLog[] = [
      ...audits.map((row) => ({
        id: `audit-${row.id}`,
        kind: 'audit' as const,
        severity: severityFor('audit'),
        message: row.event,
        company: row.company?.name ?? 'Unknown',
        at: row.at.toISOString(),
      })),
      ...moderations.map((row) => ({
        id: `moderation-${row.id}`,
        kind: 'moderation' as const,
        severity: severityFor('moderation'),
        message: `Input blocked at ${row.stage} by ${row.category} policy`,
        company: row.company?.name ?? 'Unknown',
        at: row.createdAt.toISOString(),
      })),
    ];

    return merged.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  }

  async createCompany(name: string): Promise<PlatformCompany> {
    const base = slugify(name);
    const taken = await this.prisma.company.findMany({
      where: { slug: { startsWith: base } },
      select: { slug: true },
    });
    const slug = dedupeSlug(base, new Set(taken.map((row) => row.slug)));

    try {
      const row = await this.prisma.company.create({ data: { name, slug } });
      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        createdAt: row.createdAt.toISOString(),
        employeeCount: 0,
        userCount: 0,
        openRoles: 0,
      };
    } catch {
      // dedupeSlug read-then-writes, so a concurrent create can still win the
      // unique constraint. Surface it as a conflict rather than a 500.
      throw new ConflictException('company slug already exists');
    }
  }

  /**
   * Deletes the company and, by Prisma's onDelete: Cascade on every relation,
   * everything it owns — employees, users, candidates, documents, audit trail.
   * Irreversible; the controller's guard is the only thing gating it.
   */
  async deleteCompany(id: string): Promise<{ id: string; name: string }> {
    const company = await this.prisma.company.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!company) throw new NotFoundException('company not found');
    await this.prisma.company.delete({ where: { id } });
    return company;
  }

  async deleteUser(id: string): Promise<{ id: string; companyId: string | null }> {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true, companyId: true } });
    if (!user) throw new NotFoundException('user not found');
    // Deletes the login only. The Employee record is left intact — the person
    // still exists in HR, they just lose portal access.
    await this.prisma.user.delete({ where: { id } });
    return user;
  }
}
