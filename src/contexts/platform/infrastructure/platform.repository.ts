// src/contexts/platform/infrastructure/platform.repository.ts
import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from 'src/platform/database/tenant-prisma.service';
import type {
  CompanySettings,
  AgentRun,
  AgentStatus,
  CalcRule,
  CalcRuleInput,
} from '../domain/platform.types';
import { DEFAULT_DEPARTMENTS, DEFAULT_SETTINGS } from '../domain/platform.types';
import {
  agentStatusToDb,
  calcCategoryToDb,
  rowToAgentRun,
  rowToCalcRule,
  settingsRowToDto,
} from './platform.mapper';

@Injectable()
export class PlatformRepository {
  constructor(private readonly prisma: TenantPrismaService) {}

  async getSettings(): Promise<CompanySettings> {
    // CompanySettings is 1:1 per company; the tenant extension scopes findFirst
    // to the caller's company, so this returns THIS company's row (or defaults).
    const row = await this.prisma.companySettings.findFirst({});
    if (!row) return DEFAULT_SETTINGS;
    return settingsRowToDto(row);
  }

  async saveSettings(settings: CompanySettings): Promise<CompanySettings> {
    // Get-or-create keyed by tenant (not a hardcoded id): find the company's
    // scoped row, update it if present, otherwise create one (the extension
    // stamps companyId on create). Avoids upsert, whose unique `where` can't be
    // expressed from ALS context alone.
    const existing = await this.prisma.companySettings.findFirst({});
    // reviewCadence + departments live inside the integrations JSON column (no
    // dedicated columns). Callers that omit them (e.g. the Settings page) must
    // not wipe values previously saved from the Performance/Onboarding pages.
    const reviewCadence =
      settings.reviewCadence ??
      (existing ? settingsRowToDto(existing).reviewCadence : undefined) ??
      'Annual';
    const jobTitles =
      settings.jobTitles ??
      (existing ? settingsRowToDto(existing).jobTitles : undefined) ??
      undefined;
    const departments =
      settings.departments ??
      (existing ? settingsRowToDto(existing).departments : undefined) ??
      DEFAULT_DEPARTMENTS;
    const data = {
      companyName: settings.companyName,
      provinces: settings.provinces,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      integrations: { ...settings.integrations, reviewCadence, departments, jobTitles } as any,
      recognitionPublic: settings.recognitionPublic,
    };
    if (existing) {
      await this.prisma.companySettings.update({ where: { id: existing.id }, data });
    } else {
      await this.prisma.companySettings.create({ data });
    }
    return this.getSettings();
  }

  async getAgentRuns(): Promise<AgentRun[]> {
    const rows = await this.prisma.agentRun.findMany();
    return rows.map(rowToAgentRun);
  }

  async createAgentRun(intent: string): Promise<AgentRun[]> {
    await this.prisma.agentRun.create({
      data: {
        intent,
        status: 'RUNNING',
        progress: 15,
        affected: 0,
        summary: `Agent started: ${intent}`,
        time: 'just now',
      },
    });
    return this.getAgentRuns();
  }

  async setAgentRunStatus(id: string, status: AgentStatus): Promise<AgentRun[]> {
    await this.prisma.agentRun.update({
      where: { id },
      data: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: agentStatusToDb[status] as any,
        progress: status === 'Completed' ? 100 : undefined,
      },
    });
    return this.getAgentRuns();
  }

  /* -------------------- Custom Calculator Engine --------------------- */

  async getCalcRules(): Promise<CalcRule[]> {
    const rows = await this.prisma.calcRule.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map(rowToCalcRule);
  }

  async createCalcRule(input: CalcRuleInput): Promise<CalcRule[]> {
    await this.prisma.calcRule.create({
      data: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        category: calcCategoryToDb[input.category] as any,
        field: input.field,
        operator: input.operator,
        threshold: input.threshold,
        action: input.action,
        value: input.value,
        active: input.active ?? true,
      },
    });
    return this.getCalcRules();
  }

  async updateCalcRule(id: string, input: Partial<CalcRuleInput>): Promise<CalcRule[]> {
    await this.prisma.calcRule.update({
      where: { id },
      data: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(input.category !== undefined ? { category: calcCategoryToDb[input.category] as any } : {}),
        ...(input.field !== undefined ? { field: input.field } : {}),
        ...(input.operator !== undefined ? { operator: input.operator } : {}),
        ...(input.threshold !== undefined ? { threshold: input.threshold } : {}),
        ...(input.action !== undefined ? { action: input.action } : {}),
        ...(input.value !== undefined ? { value: input.value } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
    });
    return this.getCalcRules();
  }

  async deleteCalcRule(id: string): Promise<CalcRule[]> {
    await this.prisma.calcRule.delete({ where: { id } });
    return this.getCalcRules();
  }
}
