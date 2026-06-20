// src/contexts/platform/infrastructure/platform.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/platform/database/prisma.service';
import type { CompanySettings, AgentRun, AgentStatus } from '../domain/platform.types';
import { DEFAULT_SETTINGS } from '../domain/platform.types';
import { agentStatusToDb, rowToAgentRun, settingsRowToDto } from './platform.mapper';

@Injectable()
export class PlatformRepository {
  constructor(private readonly prisma: PrismaService) {}

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
}
