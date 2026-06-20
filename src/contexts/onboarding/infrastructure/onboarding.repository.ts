// src/contexts/onboarding/infrastructure/onboarding.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/platform/database/prisma.service';
import type { ProvinceCode } from 'src/shared-kernel/province';
import { rowToCase, caseStatusToDb, ownerToDb, taskStatusToDb, accessToDb, docStatusToDb } from './onboarding.mapper';
import type { OnboardingCase, ChecklistTask, CaseDocument } from '../domain/onboarding.types';

const INCLUDE = {
  checklist: { orderBy: { order: 'asc' } },
  documents: { orderBy: { name: 'asc' } },
  consent: { orderBy: { timestamp: 'asc' } },
  auditLog: { orderBy: { at: 'asc' } },
} as const;

@Injectable()
export class OnboardingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<OnboardingCase | null> {
    const row = await this.prisma.onboardingCase.findUnique({ where: { id }, include: INCLUDE });
    return row ? rowToCase(row) : null;
  }
  async findByToken(token: string): Promise<OnboardingCase | null> {
    const row = await this.prisma.onboardingCase.findUnique({ where: { token }, include: INCLUDE });
    return row ? rowToCase(row) : null;
  }
  async list(): Promise<OnboardingCase[]> {
    const rows = await this.prisma.onboardingCase.findMany({ include: INCLUDE, orderBy: { createdAt: 'desc' } });
    return rows.map(rowToCase);
  }
  async pipeline(): Promise<{ id: string; name: string; title: string; startsInDays: number; progress: number }[]> {
    const rows = await this.prisma.onboardingCase.findMany({
      where: { status: { not: 'ACTIVE' } }, include: { checklist: true }, orderBy: { startDate: 'asc' },
    });
    return rows.map((c) => {
      const forms = c.forms as Record<string, boolean>;
      const formPct = Math.round((Object.values(forms).filter(Boolean).length / Object.values(forms).length) * 100);
      const taskPct = c.checklist.length
        ? Math.round((c.checklist.filter((t) => t.status === 'COMPLETED').length / c.checklist.length) * 100)
        : 0;
      const start = c.startDate.toISOString().slice(0, 10);
      return { id: c.id, name: c.name, title: `${c.title} · starts ${start}`, startsInDays: 0, progress: Math.round((formPct + taskPct) / 2) };
    });
  }

  async createCase(input: {
    token: string; name: string; title: string; department: string; province: ProvinceCode;
    startDate: Date; personalEmail: string; checklist: ChecklistTask[]; audit: string[];
  }): Promise<OnboardingCase> {
    const row = await this.prisma.onboardingCase.create({
      data: {
        token: input.token, name: input.name, title: input.title, department: input.department,
        province: input.province as never, startDate: input.startDate, personalEmail: input.personalEmail,
        status: 'INVITED',
        forms: { personal: false, td1: false, directDeposit: false, benefits: false, handbook: false },
        policiesAttached: [],
        checklist: { create: input.checklist.map((t, i) => ({
          label: t.label, owner: ownerToDb[t.owner] as never, status: 'PENDING',
          blocking: t.blocking, dataAccess: accessToDb[t.dataAccess] as never, order: i,
        })) },
        auditLog: { create: input.audit.map((event) => ({ event })) },
      },
      include: INCLUDE,
    });
    return rowToCase(row);
  }

  async updateForms(token: string, forms: Record<string, boolean>): Promise<void> {
    await this.prisma.onboardingCase.update({ where: { token }, data: { forms } });
  }
  async addConsentEntry(caseId: string, policy: string, version: string, ip: string): Promise<void> {
    await this.prisma.consentEntry.create({ data: { caseId, policy, version, ip } });
  }
  async setStatus(id: string, status: OnboardingCase['status']): Promise<void> {
    await this.prisma.onboardingCase.update({ where: { id }, data: { status: caseStatusToDb[status] as never } });
  }
  async addAudit(caseId: string, event: string): Promise<void> {
    await this.prisma.auditEntry.create({ data: { caseId, event } });
  }
  async replaceDocuments(caseId: string, docs: CaseDocument[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.caseDocument.deleteMany({ where: { caseId } }),
      this.prisma.caseDocument.createMany({ data: docs.map((doc) => ({
        caseId, name: doc.name, type: doc.type, folder: doc.folder,
        status: docStatusToDb[doc.status] as never,
        signedAt: doc.signedAt ? new Date(doc.signedAt) : null,
        signedBy: doc.signedBy ?? null, ip: doc.ip ?? null,
      })) }),
    ]);
  }
  async replaceChecklist(caseId: string, tasks: ChecklistTask[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.checklistTask.deleteMany({ where: { caseId } }),
      this.prisma.checklistTask.createMany({ data: tasks.map((t, i) => ({
        caseId, label: t.label, owner: ownerToDb[t.owner] as never,
        status: taskStatusToDb[t.status] as never, blocking: t.blocking,
        dataAccess: accessToDb[t.dataAccess] as never, order: i,
      })) }),
    ]);
  }
  async setTaskStatus(taskId: string, status: ChecklistTask['status']): Promise<void> {
    await this.prisma.checklistTask.update({ where: { id: taskId }, data: { status: taskStatusToDb[status] as never } });
  }
  async verifyDocument(docId: string): Promise<void> {
    await this.prisma.caseDocument.update({ where: { id: docId }, data: { status: 'VERIFIED' } });
  }
  async setPolicies(id: string, policiesAttached: string[]): Promise<void> {
    await this.prisma.onboardingCase.update({ where: { id }, data: { policiesAttached } });
  }
}
