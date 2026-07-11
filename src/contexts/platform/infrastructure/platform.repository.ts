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
import { DEFAULT_SETTINGS } from '../domain/platform.types';
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
    const row = await this.prisma.companySettings.findUnique({ where: { id: 'default' } });
    if (!row) return DEFAULT_SETTINGS;
    return settingsRowToDto(row);
  }

  async saveSettings(settings: CompanySettings): Promise<CompanySettings> {
    await this.prisma.companySettings.upsert({
      where: { id: 'default' },
      update: {
        companyName: settings.companyName,
        provinces: settings.provinces,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        integrations: settings.integrations as any,
        recognitionPublic: settings.recognitionPublic,
      },
      create: {
        id: 'default',
        companyName: settings.companyName,
        provinces: settings.provinces,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        integrations: settings.integrations as any,
        recognitionPublic: settings.recognitionPublic,
      },
    });
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
