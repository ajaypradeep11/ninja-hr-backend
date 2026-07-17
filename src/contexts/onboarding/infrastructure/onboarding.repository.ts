// src/contexts/onboarding/infrastructure/onboarding.repository.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from 'src/platform/database/tenant-prisma.service';
import { TenantContext } from 'src/platform/database/tenant-context';
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
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly tenant: TenantContext,
  ) {}

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
      where: { status: { not: 'ACTIVE' } },
      include: { checklist: true, documents: { select: { status: true } } },
      orderBy: { startDate: 'asc' },
    });
    return rows.map((c) => {
      const forms = Object.values(c.forms as Record<string, boolean>);
      // Item-weighted completion: every form, checklist task and uploaded
      // document counts once. Averaging sub-percentages let the 5 forms
      // outweigh a dozen checklist tasks, so the dashboard bar didn't track
      // real task/document completion.
      const done =
        forms.filter(Boolean).length +
        c.checklist.filter((t) => t.status === 'COMPLETED').length +
        c.documents.filter((d) => d.status === 'VERIFIED').length;
      const total = forms.length + c.checklist.length + c.documents.length;
      const start = c.startDate.toISOString().slice(0, 10);
      const startsInDays = Math.max(0, Math.ceil((c.startDate.getTime() - Date.now()) / 86_400_000));
      return {
        id: c.id, name: c.name, title: `${c.title} · starts ${start}`, startsInDays,
        progress: total ? Math.round((done / total) * 100) : 0,
      };
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
        // NESTED creates bypass the tenant extension (it only intercepts
        // top-level ops) — stamp companyId explicitly or these rows are born
        // tenantless: visible via relation includes but unmatchable by every
        // scoped mutation (tasks "display but can't be updated").
        checklist: { create: input.checklist.map((t, i) => ({
          label: t.label, owner: ownerToDb[t.owner] as never, status: 'PENDING',
          blocking: t.blocking, dataAccess: accessToDb[t.dataAccess] as never, order: i,
          companyId: this.tenant.companyId,
        })) },
        auditLog: { create: input.audit.map((event) => ({ event, companyId: this.tenant.companyId })) },
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
    const updated = await this.prisma.onboardingCase.update({
      where: { token },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { profile: profile as any },
    });
    // Propagate the birthday-privacy preference to the live Employee record
    // (when one exists by name) so team calendars/dashboards honour it
    // immediately — HR views keep the DOB regardless.
    if (typeof profile.birthdayPrivate === 'boolean') {
      await this.prisma.employee.updateMany({
        where: { name: updated.name },
        data: { birthdayPrivate: profile.birthdayPrivate },
      });
    }
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
  /**
   * Deletes ONE task, scoped to its case — returns false when the task does
   * not belong to it. A single-row delete cannot race the way the
   * delete-all + re-create of replaceChecklist can.
   */
  async deleteTask(caseId: string, taskId: string): Promise<boolean> {
    const res = await this.prisma.checklistTask.deleteMany({ where: { id: taskId, caseId } });
    return res.count > 0;
  }
  /**
   * Marks a document rejected — parked as PENDING (no REJECTED status in the
   * frozen schema) so it keeps blocking activation until re-uploaded. Returns
   * the document name for the audit entry, or null when it isn't on this case.
   */
  async rejectDocument(caseId: string, docId: string): Promise<string | null> {
    const row = await this.prisma.caseDocument.findFirst({
      where: { id: docId, caseId },
      select: { name: true },
    });
    if (!row) return null;
    await this.prisma.caseDocument.updateMany({
      where: { id: docId, caseId },
      data: { status: 'PENDING' },
    });
    return row.name;
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

  /**
   * Creates the HRIS record from the case (plus whatever the new hire has
   * submitted so far): an Employee + EMPLOYEE User.
   *
   * Called twice in a case's life, hence `status`/`firebaseUid`:
   *  - invite acceptance → PRE_HIRE + the hire's Firebase uid, so they can sign
   *    in and work through preboarding without showing up in the directory
   *    (`people.repository` lists ACTIVE/ON_STATUTORY_LEAVE only);
   *  - activation → promotes that same row to ACTIVE (see `activateEmployee`).
   *
   * Idempotent by IDENTITY: the case remembers the employee it provisioned, so
   * replays never double-create. The email lookup below is the legacy
   * self-heal path for cases activated before `employeeId` existed.
   */
  async provisionEmployee(
    caseId: string,
    opts: { status?: 'PRE_HIRE' | 'ACTIVE'; firebaseUid?: string } = {},
  ): Promise<{ created: boolean; employeeId: string } | null> {
    const row = await this.prisma.onboardingCase.findUnique({ where: { id: caseId } });
    if (!row) return null;
    if (row.employeeId) return { created: false, employeeId: row.employeeId };
    const existing = await this.prisma.employee.findFirst({ where: { email: row.personalEmail } });
    if (existing) {
      await this.linkEmployee(caseId, existing.id);
      return { created: false, employeeId: existing.id };
    }

    // The preboarding profile is optional shape-wise — activation gates require
    // the forms done, but stay defensive about individual fields.
    const p = (row.profile ?? {}) as Partial<{
      legalFirstName: string; legalLastName: string; preferredName: string;
      dateOfBirth: string; birthdayPrivate: boolean; sin: string; phone: string;
      addressStreet: string; addressCity: string; addressPostal: string;
      emergencyName: string; emergencyRelationship: string; emergencyPhone: string;
      workEligibility: string; workPermitExpiry: string;
      bankInstitution: string; bankTransit: string; bankAccount: string;
    }>;
    const legalName = [p.legalFirstName, p.legalLastName].filter(Boolean).join(' ').trim() || row.name;
    const eligibility = ELIGIBILITY_TO_DB[p.workEligibility ?? ''] ?? null;

    const employee = await this.prisma.employee.create({
      data: {
        name: legalName,
        preferredName: p.preferredName?.trim() || null,
        title: row.title,
        department: row.department,
        province: row.province,
        email: row.personalEmail,
        personalEmail: row.personalEmail,
        hireDate: row.startDate,
        birthDate: p.dateOfBirth ? new Date(p.dateOfBirth) : new Date('1970-01-01T00:00:00.000Z'),
        birthdayPrivate: p.birthdayPrivate ?? false,
        status: opts.status ?? 'ACTIVE',
        salary: 0, // compensation is set by HR post-hire; the wizard never collects it
        employeeNumber: await this.nextEmployeeNumber(),
        phone: p.phone || null,
        addressStreet: p.addressStreet || null,
        addressCity: p.addressCity || null,
        addressProvince: row.province,
        addressPostal: p.addressPostal || null,
        sin: p.sin || null,
        bankInstitution: p.bankInstitution || null,
        bankTransit: p.bankTransit || null,
        bankAccount: p.bankAccount || null,
        workEligibility: eligibility as never,
        workPermitExpiry: p.workPermitExpiry ? new Date(p.workPermitExpiry) : null,
      },
    });
    // Top-level creates on purpose (nested writes bypass the tenant stamping).
    // firebaseUid is stamped here when the hire accepted the invite themselves:
    // ActorGuard resolves them by uid, which is what makes their first
    // authenticated request work before any email is verified.
    await this.prisma.user.create({
      data: { employeeId: employee.id, role: 'EMPLOYEE', firebaseUid: opts.firebaseUid ?? null },
    });
    await this.linkEmployee(caseId, employee.id);
    if (p.emergencyName) {
      await this.prisma.emergencyContact.create({
        data: {
          employeeId: employee.id,
          name: p.emergencyName,
          relationship: p.emergencyRelationship || 'Not specified',
          phone: p.emergencyPhone || '',
        },
      });
    }
    return { created: true, employeeId: employee.id };
  }

  /** Point the case at the employee it provisioned (see `provisionEmployee`). */
  private async linkEmployee(caseId: string, employeeId: string): Promise<void> {
    await this.prisma.onboardingCase.update({ where: { id: caseId }, data: { employeeId } });
  }

  /**
   * Activation promotes the hire out of PRE_HIRE — this is the moment they
   * enter the employee directory. A no-op for anyone already ACTIVE, and it
   * deliberately touches only PRE_HIRE rows so re-activating a case can never
   * resurrect someone who has since been offboarded or terminated.
   */
  async activateEmployee(employeeId: string): Promise<boolean> {
    const res = await this.prisma.employee.updateMany({
      where: { id: employeeId, status: 'PRE_HIRE' },
      data: { status: 'ACTIVE' },
    });
    return res.count > 0;
  }

  /** The case belonging to one employee — backs the new hire's own portal. */
  async findByEmployeeId(employeeId: string): Promise<OnboardingCase | null> {
    const row = await this.prisma.onboardingCase.findFirst({ where: { employeeId }, include: INCLUDE });
    return row ? rowToCase(row) : null;
  }

  /** Next EMP-NNNN directory number (max existing + 1; null on any oddity). */
  private async nextEmployeeNumber(): Promise<string | null> {
    const rows = await this.prisma.employee.findMany({
      where: { employeeNumber: { startsWith: 'EMP-' } },
      select: { employeeNumber: true },
    });
    const max = rows
      .map((r) => Number(r.employeeNumber?.slice(4)))
      .filter((n) => Number.isFinite(n))
      .reduce((a, b) => Math.max(a, b), 0);
    return `EMP-${String(max + 1).padStart(4, '0')}`;
  }

  /**
   * Copies the case's VERIFIED documents into the employee's personal vault
   * (folder 02_Onboarding_and_Tax) so they appear in "My Profile → Documents".
   * Only when an owning Employee can be matched (by case name): a personal doc
   * must never land in the vault UNOWNED with Employee access — that would be
   * company-wide visible. Idempotent by (employee, folder, name). Returns the
   * number of newly published documents.
   */
  async publishVerifiedDocsToVault(caseId: string): Promise<number> {
    const row = await this.prisma.onboardingCase.findUnique({
      where: { id: caseId },
      select: { name: true, documents: { select: { name: true, type: true, status: true } } },
    });
    if (!row) return 0;
    const emp = await this.prisma.employee.findFirst({ where: { name: row.name }, select: { id: true } });
    if (!emp) return 0; // no Employee record yet (activation does not create one) — nothing to attach to

    const verified = row.documents.filter((d) => d.status === 'VERIFIED');
    if (verified.length === 0) return 0;
    const existing = await this.prisma.vaultDocument.findMany({
      where: { employeeId: emp.id, folder: ONBOARDING_VAULT_FOLDER },
      select: { name: true },
    });
    const have = new Set(existing.map((d) => d.name));
    const fresh = verified.filter((d) => !have.has(d.name));
    for (const d of fresh) {
      await this.prisma.vaultDocument.create({
        data: {
          name: d.name,
          type: d.type || 'Onboarding document',
          folder: ONBOARDING_VAULT_FOLDER,
          access: 'EMPLOYEE',
          uploaded: new Date(),
          employeeId: emp.id,
        },
      });
    }
    return fresh.length;
  }
}

/** Canonical vault folder for onboarding paperwork (see workplace VAULT_FOLDERS). */
const ONBOARDING_VAULT_FOLDER = '02_Onboarding_and_Tax';

/** Wizard label → WorkEligibility enum (mirrors people.mapper workEligibilityToDb). */
const ELIGIBILITY_TO_DB: Record<string, string> = {
  Citizen: 'CITIZEN',
  'Permanent Resident': 'PERMANENT_RESIDENT',
  'Work Permit': 'WORK_PERMIT',
  'Study Permit': 'STUDY_PERMIT',
};
