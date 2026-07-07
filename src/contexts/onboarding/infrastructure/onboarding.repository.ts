// src/contexts/onboarding/infrastructure/onboarding.repository.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/platform/database/prisma.service';
import type { ProvinceCode } from 'src/shared-kernel/province';
import { rowToCase, caseStatusToDb, ownerToDb, taskStatusToDb, accessToDb, docStatusToDb } from './onboarding.mapper';
import type { OnboardingCase, ChecklistTask, ChecklistTaskInput, CaseDocument } from '../domain/onboarding.types';

const INCLUDE = {
  checklist: { orderBy: { order: 'asc' } },
  // `data` is deliberately EXCLUDED — case reads must never drag file binaries;
  // the file itself streams through its own endpoint.
  documents: {
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, type: true, folder: true, status: true,
      signedAt: true, signedBy: true, ip: true, mimeType: true, size: true,
    },
  },
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
      const startsInDays = Math.max(0, Math.ceil((c.startDate.getTime() - Date.now()) / 86_400_000));
      return { id: c.id, name: c.name, title: `${c.title} · starts ${start}`, startsInDays, progress: Math.round((formPct + taskPct) / 2) };
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
  /**
   * Stores an uploaded preboarding document. Re-uploading the same document
   * (same name) replaces it, so the vault and HR queue never show duplicates.
   * Always lands as NEEDS_VERIFICATION for the human-in-the-loop HR check.
   */
  async upsertCaseFile(
    caseId: string,
    doc: { name: string; type: string; folder: string; signedBy: string; mimeType: string; data: Buffer },
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.caseDocument.deleteMany({ where: { caseId, name: doc.name } }),
      this.prisma.caseDocument.create({
        data: {
          caseId,
          name: doc.name,
          type: doc.type,
          folder: doc.folder,
          status: 'NEEDS_VERIFICATION',
          signedAt: new Date(),
          signedBy: doc.signedBy,
          mimeType: doc.mimeType,
          size: doc.data.length,
          data: new Uint8Array(doc.data),
        },
      }),
    ]);
  }

  /** The stored file for HR verification download (scoped to its case). */
  async getCaseDocumentFile(
    caseId: string,
    docId: string,
  ): Promise<{ name: string; mimeType: string; data: Buffer } | null> {
    const row = await this.prisma.caseDocument.findFirst({
      where: { id: docId, caseId },
      select: { name: true, mimeType: true, data: true },
    });
    if (!row?.data || !row.mimeType) return null;
    return { name: row.name, mimeType: row.mimeType, data: Buffer.from(row.data) };
  }

  /** Assign (or unassign with null) an internal owner for a department's tasks. */
  async setTaskAssignee(caseId: string, owner: string, employeeName: string | null): Promise<void> {
    const row = await this.prisma.onboardingCase.findUnique({
      where: { id: caseId },
      select: { taskAssignees: true },
    });
    if (!row) throw new NotFoundException('Onboarding case not found');
    const current = (row.taskAssignees as Record<string, string> | null) ?? {};
    const next = { ...current };
    if (employeeName) next[owner] = employeeName;
    else delete next[owner];
    await this.prisma.onboardingCase.update({
      where: { id: caseId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { taskAssignees: next as any },
    });
  }

  /** Raw new-hire form payload (incl. SIN/banking) — reads mask via the mapper. */
  async saveProfile(token: string, profile: Record<string, unknown>): Promise<void> {
    await this.prisma.onboardingCase.update({
      where: { token },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { profile: profile as any },
    });
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
  async replaceChecklist(caseId: string, tasks: ChecklistTaskInput[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.checklistTask.deleteMany({ where: { caseId } }),
      this.prisma.checklistTask.createMany({ data: tasks.map((t, i) => ({
        caseId, label: t.label, owner: ownerToDb[t.owner] as never,
        status: taskStatusToDb[t.status] as never, blocking: t.blocking,
        dataAccess: accessToDb[t.dataAccess] as never, order: i,
      })) }),
    ]);
  }
  /** Scoped to the case — returns false when the task does not belong to it. */
  async setTaskStatus(caseId: string, taskId: string, status: ChecklistTask['status']): Promise<boolean> {
    const res = await this.prisma.checklistTask.updateMany({
      where: { id: taskId, caseId },
      data: { status: taskStatusToDb[status] as never },
    });
    return res.count > 0;
  }
  /** Scoped to the case — returns false when the document does not belong to it. */
  async verifyDocument(caseId: string, docId: string): Promise<boolean> {
    const res = await this.prisma.caseDocument.updateMany({
      where: { id: docId, caseId },
      data: { status: 'VERIFIED' },
    });
    return res.count > 0;
  }
  async setPolicies(id: string, policiesAttached: string[]): Promise<void> {
    await this.prisma.onboardingCase.update({ where: { id }, data: { policiesAttached } });
  }
}
