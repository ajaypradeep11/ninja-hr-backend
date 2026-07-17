// src/contexts/recruitment/infrastructure/recruitment.repository.ts
import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TenantPrismaService } from 'src/platform/database/tenant-prisma.service';
import { TenantContext } from 'src/platform/database/tenant-context';
import type { ActorContext } from 'src/platform/auth/actor-context';
import {
  STAGE_TO_PORTAL,
  PRIVACY_CONSENT_VERSION,
  type Requisition,
  type RequisitionDetail,
  type RecruitmentAnalytics,
  type Candidate,
  type CandidateDetail,
  type CandidateStage,
  type CandidateSource,
  type CommunicationTemplateEntry,
  type ApplyInput,
  type ParsedResumeView,
  type JobPosting,
  type JobPostingDetail,
  type PortalView,
  type GuideSectionInput,
  DEFAULT_SCORECARD_SECTIONS,
} from '../domain/recruitment.types';
import { settleApprovals, type DbApprovalDecision } from '../domain/approval.service';
import { renderTemplate, type TemplateVars } from '../domain/template-render.service';
import { summarizeEvaluations } from '../domain/evaluation.service';
import { ResumeParserService } from './resume-parser.service';
import {
  candidateSourceToDb,
  candidateStageFromDb,
  candidateStageToDb,
  employmentTypeFromDb,
  employmentTypeToDb,
  recommendationFromDb,
  rowToCandidate,
  rowToRequisition,
  rowToRequisitionDetail,
  triggerFromDb,
  triggerToDb,
} from './recruitment.mapper';

const DETAIL_INCLUDE = {
  createdBy: true,
  approvals: { include: { approver: true }, orderBy: { id: 'asc' } },
  hiringTeam: { include: { employee: true }, orderBy: { id: 'asc' } },
  preScreenQuestions: { orderBy: { order: 'asc' } },
  scorecardCriteria: { orderBy: { order: 'asc' } },
} as const;

export interface HiringTeamInput {
  employeeId: string;
  isPanelMember: boolean;
}

export interface CreateRequisitionInput {
  title: string;
  department: string;
  province: string;
  type: string; // domain label
  salaryMin: number;
  salaryMax: number;
  jd?: string;
  approverIds: string[];
  hiringTeam: HiringTeamInput[];
}

export interface PublishingInput {
  jd?: string;
  preScreenQuestions?: { question: string; required: boolean }[];
  indeedEnabled?: boolean;
  linkedinEnabled?: boolean;
  blindHiring?: boolean;
}

/** Blind alias for candidate ordinal n within their requisition. */
const blindAlias = (n: number) => `Candidate #${n || '?'}`;

/**
 * Server-side Blind Hiring scrub for the full candidate profile. Removes the
 * name, contact details, résumé file access and employer history, and rewrites
 * name mentions inside notes/communications so the alias holds everywhere.
 */
function scrubCandidateDetail(detail: CandidateDetail, realName: string, ordinal: number): CandidateDetail {
  const alias = blindAlias(ordinal);
  // Replace the full name and each distinctive name token (len ≥ 3), so
  // "Hi Ravi," in a rendered template also masks.
  const tokens = [realName, ...realName.split(/\s+/).filter((t) => t.length >= 3)];
  const scrubText = (text: string) =>
    tokens.reduce((acc, t) => acc.split(t).join(alias), text);

  return {
    ...detail,
    blind: true,
    name: alias,
    email: undefined,
    resumeText: undefined,
    resume: detail.resume
      ? {
          ...detail.resume,
          fileName: 'Résumé (hidden while Blind Hiring is on)',
          hasFile: false,
          phone: undefined,
          workHistory: [],
        }
      : undefined,
    notes: detail.notes.map((n) => ({ ...n, body: scrubText(n.body) })),
    communications: detail.communications.map((c) => ({
      ...c,
      subject: scrubText(c.subject),
      body: scrubText(c.body),
      fromAddress: undefined,
    })),
  };
}

function slugify(title: string, id: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  // Short id suffix avoids collisions between same-titled postings.
  return `${base}-${id.slice(-4)}`;
}

@Injectable()
export class RecruitmentRepository {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly resumeParser: ResumeParserService,
    private readonly tenant: TenantContext,
  ) {}

  /* ------------------------------ Audit ------------------------------ */

  async addAudit(input: {
    requisitionId?: string;
    candidateId?: string;
    actorId?: string | null;
    event: string;
    detail?: string;
  }): Promise<void> {
    await this.prisma.recruitmentAuditEvent.create({
      data: {
        requisitionId: input.requisitionId ?? null,
        candidateId: input.candidateId ?? null,
        actorId: input.actorId ?? null,
        event: input.event,
        detail: input.detail ?? null,
      },
    });
  }

  /* --------------------------- Requisitions -------------------------- */

  /** HR sees everything; managers see requisitions they created, approve, or staff. */
  async listRequisitionsForActor(actor: ActorContext, includeArchived = false): Promise<Requisition[]> {
    const scope =
      actor.role === 'HR_ADMIN' || !actor.employeeId
        ? {}
        : {
            OR: [
              { createdById: actor.employeeId },
              { approvals: { some: { approverId: actor.employeeId } } },
              { hiringTeam: { some: { employeeId: actor.employeeId } } },
            ],
          };
    const rows = await this.prisma.requisition.findMany({
      where: { ...scope, ...(includeArchived ? {} : { archivedAt: null }) },
      include: {
        createdBy: true,
        // Dashboard stat: candidates currently in the Interview stage.
        _count: { select: { candidates: { where: { stage: 'INTERVIEW' } } } },
        // The actor's own membership row (if any) — powers viewer* flags.
        hiringTeam: {
          where: { employeeId: actor.employeeId ?? '__none__' },
          select: { isPanelMember: true },
        },
      },
      orderBy: [{ archivedAt: 'asc' }, { openedDate: 'desc' }],
    });
    return rows.map((row) => ({
      ...rowToRequisition(row),
      viewerIsHiringManager: !!actor.employeeId && row.createdById === actor.employeeId,
      viewerOnHiringTeam: row.hiringTeam.length > 0,
      viewerIsPanelMember: row.hiringTeam.some((m) => m.isPanelMember),
    }));
  }

  /** Archive or restore a requisition (HR only). Archived roles drop off lists. */
  async setArchived(id: string, archived: boolean, actor: ActorContext): Promise<Requisition[]> {
    await this.prisma.requisition.update({
      where: { id },
      data: { archivedAt: archived ? new Date() : null },
    });
    await this.addAudit({
      requisitionId: id,
      actorId: actor.employeeId,
      event: archived ? 'ARCHIVED' : 'UNARCHIVED',
    });
    return this.listRequisitionsForActor(actor, true);
  }

  /** Permanently delete a requisition and everything under it (HR only). */
  async deleteRequisition(id: string, actor: ActorContext): Promise<Requisition[]> {
    const existing = await this.prisma.requisition.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException(`Requisition ${id} not found`);

    // Audit before the cascade removes the requisition's own audit rows. This row
    // has no requisitionId, so it survives the delete as a standalone record.
    await this.addAudit({ actorId: actor.employeeId, event: 'REQUISITION_DELETED', detail: id });

    // Candidates are onDelete:SetNull, so deleting the requisition alone would leave
    // orphaned applications. Remove them explicitly (cascading their resumes, notes,
    // communications and scorecards) so "delete the role" also clears its pipeline.
    await this.prisma.$transaction([
      this.prisma.candidate.deleteMany({ where: { requisitionId: id } }),
      this.prisma.requisition.delete({ where: { id } }),
    ]);
    return this.listRequisitionsForActor(actor, true);
  }

  async getDetail(id: string): Promise<RequisitionDetail> {
    const row = await this.prisma.requisition.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    if (!row) throw new NotFoundException(`Requisition ${id} not found`);
    return rowToRequisitionDetail(row);
  }

  /** Throws unless the actor may view this requisition (HR/creator/approver/team). */
  assertCanView(detail: RequisitionDetail, actor: ActorContext): void {
    if (actor.role === 'HR_ADMIN') return;
    const emp = actor.employeeId;
    if (!emp) throw new ForbiddenException('No employee identity');
    const allowed =
      detail.createdById === emp ||
      detail.approvals.some((a) => a.approverId === emp) ||
      detail.hiringTeam.some((m) => m.employeeId === emp);
    if (!allowed) throw new ForbiddenException('Not part of this requisition');
  }

  /** Throws unless the actor is HR, the hiring manager (creator), or on the hiring team. */
  assertOnHiringTeam(detail: RequisitionDetail, actor: ActorContext): void {
    if (actor.role === 'HR_ADMIN') return;
    const emp = actor.employeeId;
    if (
      !emp ||
      (detail.createdById !== emp && !detail.hiringTeam.some((m) => m.employeeId === emp))
    ) {
      throw new ForbiddenException('Only the hiring manager or hiring team can access candidates');
    }
  }

  async createRequisition(input: CreateRequisitionInput, actor: ActorContext): Promise<RequisitionDetail> {
    // Every position starts from the company's CURRENT standard interview
    // guide (editable at /admin/recruitment/interview-guide); the requisition
    // gets its own copy that admins can tailor independently.
    const guide = await this.getGuideTemplate();
    const row = await this.prisma.requisition.create({
      data: {
        title: input.title,
        department: input.department,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        province: input.province as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type: (employmentTypeToDb[input.type as keyof typeof employmentTypeToDb] ?? 'FULL_TIME') as any,
        salaryMin: input.salaryMin,
        salaryMax: input.salaryMax,
        status: 'DRAFT',
        applicants: 0,
        openedDate: new Date(),
        jd: input.jd ?? null,
        createdById: actor.employeeId,
        // Nested creates bypass the tenant extension — stamp companyId explicitly.
        approvals: { create: input.approverIds.map((approverId) => ({ approverId, companyId: this.tenant.companyId })) },
        hiringTeam: {
          create: input.hiringTeam.map((m) => ({ employeeId: m.employeeId, isPanelMember: m.isPanelMember, companyId: this.tenant.companyId })),
        },
        scorecardCriteria: {
          create: guide.map((s, i) => ({
            name: s.name,
            weight: s.weight ?? null,
            guidance: s.guidance ?? null,
            order: i,
            companyId: this.tenant.companyId,
          })),
        },
      },
      include: DETAIL_INCLUDE,
    });
    await this.addAudit({ requisitionId: row.id, actorId: actor.employeeId, event: 'CREATED', detail: input.title });
    return rowToRequisitionDetail(row);
  }

  async updateRequisition(id: string, input: CreateRequisitionInput, actor: ActorContext): Promise<RequisitionDetail> {
    const detail = await this.getDetail(id);
    // Editable at any stage until the first application arrives — so HR/managers
    // can fix the JD, salary, or hiring panel right up to going live.
    if (detail.applicants > 0) {
      throw new ConflictException('This requisition already has applications and can no longer be edited');
    }
    if (actor.role !== 'HR_ADMIN' && detail.createdById !== actor.employeeId) {
      throw new ForbiddenException('Only the creator or HR can edit this requisition');
    }

    const ops = [
      this.prisma.requisition.update({
        where: { id },
        data: {
          title: input.title,
          department: input.department,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          province: input.province as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          type: (employmentTypeToDb[input.type as keyof typeof employmentTypeToDb] ?? 'FULL_TIME') as any,
          salaryMin: input.salaryMin,
          salaryMax: input.salaryMax,
          jd: input.jd ?? null,
        },
      }),
      this.prisma.hiringTeamMember.deleteMany({ where: { requisitionId: id } }),
      this.prisma.hiringTeamMember.createMany({
        data: input.hiringTeam.map((m) => ({
          requisitionId: id,
          employeeId: m.employeeId,
          isPanelMember: m.isPanelMember,
        })),
      }),
    ];
    // Approver-list edits only make sense before approvals go live; a Draft can
    // freely re-pick approvers, but Pending/Approved carry real decisions.
    if (detail.status === 'Draft') {
      ops.push(this.prisma.requisitionApproval.deleteMany({ where: { requisitionId: id } }));
      ops.push(
        this.prisma.requisitionApproval.createMany({
          data: input.approverIds.map((approverId) => ({ requisitionId: id, approverId })),
        }),
      );
    }
    await this.prisma.$transaction(ops);
    await this.addAudit({ requisitionId: id, actorId: actor.employeeId, event: 'EDITED' });
    return this.getDetail(id);
  }

  async submitForApproval(id: string, actor: ActorContext): Promise<RequisitionDetail> {
    const detail = await this.getDetail(id);
    if (detail.status !== 'Draft') throw new ConflictException('Only Draft requisitions can be submitted');
    if (actor.role !== 'HR_ADMIN' && detail.createdById !== actor.employeeId) {
      throw new ForbiddenException('Only the creator or HR can submit this requisition');
    }
    if (detail.approvals.length === 0) {
      throw new BadRequestException('Add at least one approver before submitting');
    }
    // Bill 149 state-block: a requisition may not leave Draft without a salary band.
    if (!detail.salaryMin || !detail.salaryMax) {
      throw new BadRequestException('Cannot submit: Bill 149 requires a posted salary range.');
    }
    await this.prisma.$transaction([
      // Re-submission resets every prior decision.
      this.prisma.requisitionApproval.updateMany({
        where: { requisitionId: id },
        data: { decision: 'PENDING', comment: null, decidedAt: null },
      }),
      this.prisma.requisition.update({
        where: { id },
        data: { status: 'PENDING_APPROVAL', rejectionFeedback: null },
      }),
    ]);
    await this.addAudit({ requisitionId: id, actorId: actor.employeeId, event: 'SUBMITTED' });
    return this.getDetail(id);
  }

  async decide(
    id: string,
    actor: ActorContext,
    decision: 'Approved' | 'Rejected',
    comment?: string,
  ): Promise<RequisitionDetail> {
    const detail = await this.getDetail(id);
    if (detail.status !== 'Pending Approval') {
      throw new ConflictException('Requisition is not awaiting approval');
    }
    const mine = detail.approvals.find((a) => a.approverId === actor.employeeId);
    if (!mine) throw new ForbiddenException('You are not a named approver for this requisition');
    if (mine.decision !== 'Pending') throw new ConflictException('You have already decided');

    await this.prisma.requisitionApproval.update({
      where: { id: mine.id },
      data: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        decision: (decision === 'Approved' ? 'APPROVED' : 'REJECTED') as any,
        comment: comment ?? null,
        decidedAt: new Date(),
      },
    });
    await this.addAudit({
      requisitionId: id,
      actorId: actor.employeeId,
      event: decision.toUpperCase(),
      detail: comment,
    });

    // Settle: all approved → Approved; any rejection → back to Draft with feedback.
    const rows = await this.prisma.requisitionApproval.findMany({ where: { requisitionId: id } });
    const outcome = settleApprovals(rows.map((r) => r.decision as DbApprovalDecision));
    if (outcome === 'approved') {
      await this.prisma.requisition.update({ where: { id }, data: { status: 'APPROVED' } });
      await this.addAudit({ requisitionId: id, event: 'ALL_APPROVED' });
    } else if (outcome === 'rejected') {
      await this.prisma.requisition.update({
        where: { id },
        data: { status: 'DRAFT', rejectionFeedback: comment ?? 'Rejected by approver' },
      });
    }
    return this.getDetail(id);
  }

  /** HR-only publishing prep: JD, pre-screening questions, job-board toggles. */
  async updatePublishing(id: string, input: PublishingInput, actor: ActorContext): Promise<RequisitionDetail> {
    const detail = await this.getDetail(id);
    if (detail.status !== 'Approved' && detail.status !== 'Published') {
      throw new ConflictException('Publishing details can only be edited after approval');
    }
    const ops = [];
    ops.push(
      this.prisma.requisition.update({
        where: { id },
        data: {
          ...(input.jd !== undefined ? { jd: input.jd } : {}),
          ...(input.indeedEnabled !== undefined ? { indeedEnabled: input.indeedEnabled } : {}),
          ...(input.linkedinEnabled !== undefined ? { linkedinEnabled: input.linkedinEnabled } : {}),
          ...(input.blindHiring !== undefined ? { blindHiring: input.blindHiring } : {}),
        },
      }),
    );
    if (input.preScreenQuestions) {
      ops.push(this.prisma.preScreenQuestion.deleteMany({ where: { requisitionId: id } }));
      ops.push(
        this.prisma.preScreenQuestion.createMany({
          data: input.preScreenQuestions.map((q, i) => ({
            requisitionId: id,
            order: i,
            question: q.question,
            required: q.required,
          })),
        }),
      );
    }
    await this.prisma.$transaction(ops);
    await this.addAudit({ requisitionId: id, actorId: actor.employeeId, event: 'PUBLISHING_UPDATED' });
    return this.getDetail(id);
  }

  async publish(id: string, actor: ActorContext): Promise<RequisitionDetail> {
    const detail = await this.getDetail(id);
    if (detail.status !== 'Approved') {
      throw new ConflictException('Only Approved requisitions can be published');
    }
    if (!detail.jd || detail.jd.trim().length === 0) {
      throw new BadRequestException('Add a job description before publishing');
    }
    // Bill 149 state-block: no public posting without a salary band.
    if (!detail.salaryMin || !detail.salaryMax) {
      throw new BadRequestException('Cannot publish: Bill 149 requires a posted salary range.');
    }
    const slug = detail.slug ?? slugify(detail.title, id);
    // Simulated job-board integrations: deep-links point at the external
    // posting; real Indeed/LinkedIn APIs can replace these URLs later.
    const externalUrl = `/careers/${slug}`;
    await this.prisma.requisition.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        slug,
        publishedAt: new Date(),
        indeedUrl: detail.indeedEnabled ? `https://ca.indeed.com/viewjob?ref=ninjahr&posting=${slug}` : null,
        linkedinUrl: detail.linkedinEnabled ? `https://www.linkedin.com/jobs/view/ninjahr-${slug}` : null,
      },
    });
    await this.addAudit({
      requisitionId: id,
      actorId: actor.employeeId,
      event: 'PUBLISHED',
      detail: externalUrl,
    });
    return this.getDetail(id);
  }

  /* ---------------------------- Candidates --------------------------- */

  async getRequisitions(): Promise<Requisition[]> {
    const rows = await this.prisma.requisition.findMany({
      include: { createdBy: true },
      orderBy: { openedDate: 'desc' },
    });
    return rows.map(rowToRequisition);
  }

  async getCandidates(): Promise<Candidate[]> {
    const rows = await this.prisma.candidate.findMany({
      orderBy: { matchScore: 'desc' },
    });
    return rows.map(rowToCandidate);
  }

  async getCandidatesForRequisition(requisitionId: string, actor?: ActorContext): Promise<Candidate[]> {
    const rows = await this.prisma.candidate.findMany({
      where: { requisitionId },
      orderBy: { matchScore: 'desc' },
    });
    const candidates = rows.map(rowToCandidate);

    // Admin-controlled Blind Hiring: alias names for every non-HR viewer.
    if (actor && actor.role !== 'HR_ADMIN') {
      const req = await this.prisma.requisition.findUnique({
        where: { id: requisitionId },
        select: { blindHiring: true },
      });
      if (req?.blindHiring) {
        const ordinals = await this.blindOrdinals(requisitionId);
        return candidates.map((c) => ({ ...c, name: blindAlias(ordinals.get(c.id) ?? 0) }));
      }
    }
    return candidates;
  }

  async setCandidateStage(id: string, stage: CandidateStage): Promise<Candidate[]> {
    await this.prisma.candidate.update({
      where: { id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { stage: candidateStageToDb[stage] as any },
    });
    return this.getCandidates();
  }

  /** Generates a unique, unguessable candidate portal token. */
  newPortalToken(): string {
    return `cand_${randomBytes(18).toString('base64url')}`;
  }

  /* ------------------------- Public job board ------------------------ */

  private jobShape(row: {
    slug: string | null;
    title: string;
    department: string;
    province: unknown;
    type: unknown;
    salaryMin: number;
    salaryMax: number;
    publishedAt: Date | null;
  }): JobPosting {
    return {
      slug: row.slug ?? '',
      title: row.title,
      department: row.department,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      province: row.province as any,
      type: employmentTypeFromDb[row.type as keyof typeof employmentTypeFromDb],
      salaryMin: row.salaryMin,
      salaryMax: row.salaryMax,
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : undefined,
    };
  }

  async listPublishedJobs(): Promise<JobPosting[]> {
    const rows = await this.prisma.requisition.findMany({
      // Legacy demo rows are PUBLISHED without a slug/JD — not real postings.
      // Archived roles must not appear on the public careers site.
      where: { status: 'PUBLISHED', slug: { not: null }, archivedAt: null },
      orderBy: { publishedAt: 'desc' },
    });
    return rows.map((r) => this.jobShape(r));
  }

  async getJobBySlug(slug: string): Promise<JobPostingDetail> {
    const row = await this.prisma.requisition.findUnique({
      where: { slug },
      include: { preScreenQuestions: { orderBy: { order: 'asc' } } },
    });
    if (!row || row.status !== 'PUBLISHED') throw new NotFoundException('Job posting not found');
    return {
      ...this.jobShape(row),
      jd: row.jd ?? '',
      preScreenQuestions: row.preScreenQuestions.map((q) => ({
        id: q.id,
        order: q.order,
        question: q.question,
        required: q.required,
      })),
    };
  }

  /** Careers-page application: candidate + consent + portal token + confirmation. */
  async apply(slug: string, input: ApplyInput): Promise<{ portalToken: string }> {
    const req = await this.prisma.requisition.findUnique({
      where: { slug },
      include: { preScreenQuestions: true },
    });
    if (!req || req.status !== 'PUBLISHED') throw new NotFoundException('Job posting not found');

    // Required pre-screening questions must all be answered.
    const answered = new Set(input.answers.map((a) => a.questionId));
    const missing = req.preScreenQuestions.filter((q) => q.required && !answered.has(q.id));
    if (missing.length > 0) {
      throw new BadRequestException(`Please answer: ${missing.map((q) => q.question).join('; ')}`);
    }
    const validQuestionIds = new Set(req.preScreenQuestions.map((q) => q.id));

    const portalToken = this.newPortalToken();
    const candidate = await this.prisma.candidate.create({
      data: {
        requisitionId: req.id,
        name: input.name,
        role: req.title,
        stage: 'APPLIED',
        email: input.email,
        resumeText: input.resumeText ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        source: candidateSourceToDb[input.source] as any,
        portalToken,
        consentAt: new Date(),
        consentVersion: PRIVACY_CONSENT_VERSION,
        answers: {
          // Nested create — stamp explicitly (tenant extension skips these).
          create: input.answers
            .filter((a) => validQuestionIds.has(a.questionId))
            .map((a) => ({ questionId: a.questionId, answer: a.answer, companyId: this.tenant.companyId })),
        },
      },
    });
    // Denormalized counter — atomic increment, analytics prefer count(candidates).
    await this.prisma.requisition.update({
      where: { id: req.id },
      data: { applicants: { increment: 1 } },
    });

    // Résumé: store the file and AI-parse it (best-effort — never blocks the
    // application; a parse failure just leaves the structured fields empty).
    if (input.resumeFileBase64 && input.resumeFileName && input.resumeMimeType) {
      try {
        const parsed = await this.resumeParser.parse({
          text: input.resumeText,
          fileBase64: input.resumeFileBase64,
          mimeType: input.resumeMimeType,
        });
        await this.prisma.candidateResume.create({
          data: {
            candidateId: candidate.id,
            fileName: input.resumeFileName,
            mimeType: input.resumeMimeType,
            data: Buffer.from(input.resumeFileBase64, 'base64'),
            parsedPhone: parsed.phone ?? null,
            parsedSkills: parsed.skills,
            parsedWorkHistory: parsed.workHistory as unknown as object,
            parseStatus: parsed.status,
            parsedAt: new Date(),
          },
        });
        // Backfill the candidate's email from the résumé if they left it blank.
        if (!input.email && parsed.email) {
          await this.prisma.candidate.update({ where: { id: candidate.id }, data: { email: parsed.email } });
        }
      } catch (err) {
        // Storing/parsing the résumé must never fail the application itself.
        await this.addAudit({
          candidateId: candidate.id,
          event: 'RESUME_PARSE_ERROR',
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await this.sendTemplated(candidate.id, 'APPLICATION_RECEIVED', {
      candidate_name: input.name,
      job_title: req.title,
      company: 'NinjaHR',
    });
    await this.addAudit({
      requisitionId: req.id,
      candidateId: candidate.id,
      event: 'APPLICATION_RECEIVED',
      detail: `${input.name} via ${input.source}`,
    });
    return { portalToken };
  }

  /** Résumé metadata + parsed data for the candidate detail (no binary). */
  async getResumeView(candidateId: string): Promise<ParsedResumeView | null> {
    const row = await this.prisma.candidateResume.findUnique({
      where: { candidateId },
      select: {
        fileName: true,
        parseStatus: true,
        parsedPhone: true,
        parsedSkills: true,
        parsedWorkHistory: true,
      },
    });
    if (!row) return null;
    return {
      fileName: row.fileName,
      parseStatus: row.parseStatus as ParsedResumeView['parseStatus'],
      phone: row.parsedPhone ?? undefined,
      skills: row.parsedSkills,
      workHistory: (row.parsedWorkHistory as ParsedResumeView['workHistory']) ?? [],
      hasFile: true,
    };
  }

  /** Raw résumé file for download (RBAC enforced by the caller). */
  async getResumeFile(
    candidateId: string,
  ): Promise<{ fileName: string; mimeType: string; data: Buffer } | null> {
    const row = await this.prisma.candidateResume.findUnique({ where: { candidateId } });
    if (!row) return null;
    return { fileName: row.fileName, mimeType: row.mimeType, data: Buffer.from(row.data) };
  }

  /* --------------------- Internal evaluation notes ------------------- */

  /**
   * Add an internal hiring-team note. STRICTLY internal — this data lives in a
   * dedicated table and is never read by any candidate-facing (portal, comms)
   * or external (job-board) code path, so it cannot leak to the candidate.
   */
  async addNote(candidateId: string, body: string, actor: ActorContext): Promise<CandidateDetail> {
    await this.prisma.candidateNote.create({
      data: { candidateId, authorId: actor.employeeId, body },
    });
    await this.addAudit({
      candidateId,
      actorId: actor.employeeId,
      event: 'NOTE_ADDED',
    });
    return this.getCandidateDetail(candidateId, actor);
  }

  /**
   * Records an inbound candidate reply into the two-way mailbox. Called by the
   * inbound-email webhook (routed via the candidate's portal token, the same
   * way SendGrid Inbound Parse / SES would address reply+<token>@ mail) and by
   * the HR "simulate reply" demo helper.
   */
  async recordInboundReply(
    candidate: { id: string } | { portalToken: string },
    input: { from?: string; subject?: string; body: string },
  ): Promise<CandidateDetail> {
    const row =
      'id' in candidate
        ? await this.prisma.candidate.findUnique({ where: { id: candidate.id } })
        : await this.prisma.candidate.findUnique({ where: { portalToken: candidate.portalToken } });
    if (!row) throw new NotFoundException('Candidate not found for inbound message');
    if (row.anonymizedAt) throw new ConflictException('Candidate record has been anonymized');

    await this.prisma.communicationLog.create({
      data: {
        candidateId: row.id,
        subject: input.subject?.trim() || 'Re: your application',
        body: input.body,
        direction: 'INBOUND',
        fromAddress: input.from ?? row.email,
        sentById: null,
        visibleToCandidate: true,
      },
    });
    await this.addAudit({
      requisitionId: row.requisitionId ?? undefined,
      candidateId: row.id,
      event: 'INBOUND_EMAIL',
      detail: input.subject ?? undefined,
    });
    return this.getCandidateDetail(row.id);
  }

  /** Candidates the actor may evaluate — reqs where they're on the hiring team. */
  async getAssignedCandidates(actor: ActorContext): Promise<Candidate[]> {
    if (!actor.employeeId) return [];
    const rows = await this.prisma.candidate.findMany({
      where: { requisition: { hiringTeam: { some: { employeeId: actor.employeeId } } } },
      orderBy: { appliedDate: 'desc' },
      include: { requisition: { select: { blindHiring: true } } },
    });
    // Alias names on blind requisitions (non-HR list): ordinals computed per req.
    const blindReqIds = [
      ...new Set(
        rows
          .filter((r) => r.requisition?.blindHiring && actor.role !== 'HR_ADMIN')
          .map((r) => r.requisitionId as string),
      ),
    ];
    const ordinalMaps = new Map<string, Map<string, number>>();
    for (const reqId of blindReqIds) ordinalMaps.set(reqId, await this.blindOrdinals(reqId));
    return rows.map((r) => {
      const c = rowToCandidate(r);
      const ords = r.requisitionId ? ordinalMaps.get(r.requisitionId) : undefined;
      return ords ? { ...c, name: blindAlias(ords.get(c.id) ?? 0) } : c;
    });
  }

  /* ------------------------- Communications -------------------------- */

  /**
   * The single "send" seam: renders the trigger's template and records it in
   * the CommunicationLog. Plug a real email provider in here later.
   */
  async sendTemplated(
    candidateId: string,
    trigger: 'APPLICATION_RECEIVED' | 'INTERVIEW_SCHEDULED' | 'REJECTED',
    vars: TemplateVars,
    sentById?: string | null,
  ): Promise<void> {
    const template = await this.prisma.communicationTemplate.findFirst({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where: { trigger: trigger as any },
      orderBy: { isDefault: 'desc' },
    });
    if (!template) return; // no template configured — nothing to send
    await this.prisma.communicationLog.create({
      data: {
        candidateId,
        templateId: template.id,
        subject: renderTemplate(template.subject, vars),
        body: renderTemplate(template.body, vars),
        sentById: sentById ?? null,
        visibleToCandidate: true,
      },
    });
  }

  /* --------------------------- Candidate portal ---------------------- */

  async getPortalView(token: string): Promise<PortalView> {
    const row = await this.prisma.candidate.findUnique({
      where: { portalToken: token },
      include: {
        requisition: true,
        communications: { where: { visibleToCandidate: true }, orderBy: { sentAt: 'desc' } },
      },
    });
    if (!row) throw new NotFoundException('Application not found');
    const stage = candidateStageFromDb[row.stage as keyof typeof candidateStageFromDb];
    return {
      candidateName: row.name,
      jobTitle: row.requisition?.title ?? row.role,
      status: row.withdrawnAt ? 'Withdrawn' : STAGE_TO_PORTAL[stage],
      appliedDate: row.appliedDate.toISOString().slice(0, 10),
      withdrawn: !!row.withdrawnAt,
      communications: row.communications.map((c) => ({
        subject: c.subject,
        body: c.body,
        sentAt: c.sentAt.toISOString(),
      })),
    };
  }

  async withdrawByToken(token: string): Promise<PortalView> {
    const row = await this.prisma.candidate.findUnique({ where: { portalToken: token } });
    if (!row) throw new NotFoundException('Application not found');
    if (!row.withdrawnAt) {
      await this.prisma.candidate.update({
        where: { id: row.id },
        data: { withdrawnAt: new Date() },
      });
      await this.addAudit({
        requisitionId: row.requisitionId ?? undefined,
        candidateId: row.id,
        event: 'WITHDRAWN',
        detail: 'Candidate withdrew via portal',
      });
    }
    return this.getPortalView(token);
  }

  /* ---------------------- Candidate management ----------------------- */

  /** Enforces HR/hiring-team access for a candidate; returns its requisition id. */
  async assertCandidateAccess(candidateId: string, actor: ActorContext): Promise<string | null> {
    const row = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { requisitionId: true, requisition: { select: { createdById: true } } },
    });
    if (!row) throw new NotFoundException(`Candidate ${candidateId} not found`);
    if (actor.role === 'HR_ADMIN') return row.requisitionId;
    if (!row.requisitionId) throw new ForbiddenException('Only HR can access unassigned candidates');
    // The hiring manager (creator) gets the same scoped access as the team.
    if (!!actor.employeeId && row.requisition?.createdById === actor.employeeId) {
      return row.requisitionId;
    }
    const member = await this.prisma.hiringTeamMember.findFirst({
      where: { requisitionId: row.requisitionId, employeeId: actor.employeeId ?? '__none__' },
    });
    if (!member) throw new ForbiddenException('Only the hiring manager or hiring team can access this candidate');
    return row.requisitionId;
  }

  async getCandidateDetail(id: string, actor?: ActorContext): Promise<CandidateDetail> {
    const row = await this.prisma.candidate.findUnique({
      where: { id },
      include: {
        requisition: {
          include: {
            scorecardCriteria: { orderBy: { order: 'asc' } },
            hiringTeam: true,
          },
        },
        answers: { include: { question: true }, orderBy: { question: { order: 'asc' } } },
        communications: { include: { sentBy: true, template: true }, orderBy: { sentAt: 'desc' } },
        scorecards: {
          include: { panelist: true, ratings: { include: { criterion: true } } },
          orderBy: { submittedAt: 'desc' },
        },
        notes: { include: { author: true }, orderBy: { createdAt: 'desc' } },
        resume: {
          select: {
            fileName: true,
            mimeType: true,
            parseStatus: true,
            parsedPhone: true,
            parsedSkills: true,
            parsedWorkHistory: true,
          },
        },
        auditEvents: { orderBy: { at: 'desc' }, take: 25 },
      },
    });
    if (!row) throw new NotFoundException(`Candidate ${id} not found`);
    // Panel-feedback visibility rules:
    //  1. A Draft is PRIVATE to its author — always.
    //  2. Debrief gating: a PANELIST only unlocks the other panelists' submitted
    //     cards after submitting their own — so nobody reads the panel before
    //     forming an independent opinion. HR and non-panel viewers (recruiters,
    //     the hiring manager) see submitted cards immediately.
    const viewerIsPanelist =
      !!actor?.employeeId &&
       
      (row.requisition?.hiringTeam ?? []).some(
        (m: any) => m.employeeId === actor.employeeId && m.isPanelMember,
      );
    const viewerHasSubmitted =
      !!actor?.employeeId &&
      row.scorecards.some((s) => s.panelistId === actor.employeeId && s.status === 'SUBMITTED');
    const canSeeOthers = actor?.role === 'HR_ADMIN' || !viewerIsPanelist || viewerHasSubmitted;
    const visibleScorecards = row.scorecards.filter(
      (s) =>
        (!!actor?.employeeId && s.panelistId === actor.employeeId) ||
        (s.status === 'SUBMITTED' && canSeeOthers),
    );
    const scorecardEntries = visibleScorecards.map((s) => ({
      id: s.id,
      panelistId: s.panelistId,
      panelistName: s.panelist.name,
      recommendation: recommendationFromDb[s.recommendation as keyof typeof recommendationFromDb],
      overallNotes: s.overallNotes ?? undefined,
      status: (s.status === 'SUBMITTED' ? 'Submitted' : 'Draft') as 'Draft' | 'Submitted',
      submittedAt: s.submittedAt.toISOString(),
      ratings: s.ratings.map((r) => ({
        criterionId: r.criterionId,
        criterionName: r.criterion.name,
        rating: r.rating,
        notes: r.notes ?? undefined,
      })),
    }));
    const detail: CandidateDetail = {
      ...rowToCandidate(row),
      email: row.email ?? undefined,
      resumeText: row.resumeText ?? undefined,
      consentAt: row.consentAt ? row.consentAt.toISOString() : undefined,
      consentVersion: row.consentVersion ?? undefined,
      requisitionTitle: row.requisition?.title ?? undefined,
      resume: row.resume
        ? {
            fileName: row.resume.fileName,
            mimeType: row.resume.mimeType,
            parseStatus: row.resume.parseStatus as ParsedResumeView['parseStatus'],
            phone: row.resume.parsedPhone ?? undefined,
            skills: row.resume.parsedSkills,
            workHistory: (row.resume.parsedWorkHistory as ParsedResumeView['workHistory']) ?? [],
            hasFile: true,
          }
        : undefined,
      notes: row.notes.map((n) => ({
        id: n.id,
        authorName: n.author?.name ?? undefined,
        body: n.body,
        createdAt: n.createdAt.toISOString(),
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      scorecardCriteria: (row.requisition?.scorecardCriteria ?? []).map((c: any) => ({
        id: c.id,
        name: c.name,
        weight: c.weight ?? undefined,
        guidance: c.guidance ?? undefined,
        order: c.order,
      })),
      viewerIsPanelMember: actor?.role === 'HR_ADMIN' || viewerIsPanelist,
      viewerHasSubmitted,
      blind: false,
      answers: row.answers.map((a) => ({ question: a.question.question, answer: a.answer })),
      communications: row.communications.map((c) => ({
        id: c.id,
        subject: c.subject,
        body: c.body,
        sentAt: c.sentAt.toISOString(),
        sentByName: c.sentBy?.name ?? undefined,
        templateName: c.template?.name ?? undefined,
        visibleToCandidate: c.visibleToCandidate,
        direction: (c.direction === 'INBOUND' ? 'Inbound' : 'Outbound') as 'Inbound' | 'Outbound',
        fromAddress: c.fromAddress ?? undefined,
      })),
      scorecards: scorecardEntries,
      evaluationSummary: summarizeEvaluations(scorecardEntries),
      auditTrail: row.auditEvents.map((e) => ({
        event: e.event,
        detail: e.detail ?? undefined,
        at: e.at.toISOString(),
      })),
    };

    // Admin-controlled Blind Hiring: scrub identity for every non-HR viewer.
    // Enforced HERE (not in the UI) so a scoped API call can never leak the name.
    if (row.requisition?.blindHiring && actor?.role !== 'HR_ADMIN' && row.requisitionId) {
      const ordinals = await this.blindOrdinals(row.requisitionId);
      return scrubCandidateDetail(detail, row.name, ordinals.get(row.id) ?? 0);
    }
    return detail;
  }

  /** True when the candidate's requisition currently has Blind Hiring on. */
  async isCandidateBlindForViewer(candidateId: string): Promise<boolean> {
    const row = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { requisition: { select: { blindHiring: true } } },
    });
    return !!row?.requisition?.blindHiring;
  }

  /** Stable per-requisition ordinals (appliedDate, then id) for blind aliases. */
  private async blindOrdinals(requisitionId: string): Promise<Map<string, number>> {
    const ids = await this.prisma.candidate.findMany({
      where: { requisitionId },
      orderBy: [{ appliedDate: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    return new Map(ids.map((c, i) => [c.id, i + 1]));
  }

  /**
   * Stage change with communication triggers: →Interview sends the invite
   * template (and stamps interviewDate), →Rejected sends the rejection.
   */
  async setCandidateStageScoped(
    id: string,
    stage: CandidateStage,
    actor: ActorContext,
  ): Promise<Candidate[]> {
    const row = await this.prisma.candidate.findUnique({ where: { id }, include: { requisition: true } });
    if (!row) throw new NotFoundException(`Candidate ${id} not found`);
    const previous = candidateStageFromDb[row.stage as keyof typeof candidateStageFromDb];

    await this.prisma.candidate.update({
      where: { id },
      data: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        stage: candidateStageToDb[stage] as any,
        ...(stage === 'Interview' && !row.interviewDate ? { interviewDate: new Date() } : {}),
      },
    });
    await this.addAudit({
      requisitionId: row.requisitionId ?? undefined,
      candidateId: id,
      actorId: actor.employeeId,
      event: 'STAGE_CHANGED',
      detail: `${previous} → ${stage}`,
    });

    const vars = {
      candidate_name: row.name,
      job_title: row.requisition?.title ?? row.role,
      company: 'NinjaHR',
      interview_date: new Date().toISOString().slice(0, 10),
    };
    if (stage === 'Interview' && previous !== 'Interview') {
      await this.sendTemplated(id, 'INTERVIEW_SCHEDULED', vars, actor.employeeId);
    }
    if (stage === 'Rejected' && previous !== 'Rejected') {
      await this.sendTemplated(id, 'REJECTED', vars, actor.employeeId);
    }

    return row.requisitionId
      ? this.getCandidatesForRequisition(row.requisitionId, actor)
      : this.getCandidates();
  }

  async sendManualCommunication(
    candidateId: string,
    input: { templateId?: string; subject?: string; body?: string },
    actor: ActorContext,
  ): Promise<CandidateDetail> {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
      include: { requisition: true },
    });
    if (!candidate) throw new NotFoundException(`Candidate ${candidateId} not found`);

    const vars = {
      candidate_name: candidate.name,
      job_title: candidate.requisition?.title ?? candidate.role,
      company: 'NinjaHR',
      interview_date: candidate.interviewDate
        ? candidate.interviewDate.toISOString().slice(0, 10)
        : undefined,
    };

    let subject = input.subject ?? '';
    let body = input.body ?? '';
    let templateId: string | null = null;
    if (input.templateId) {
      const template = await this.prisma.communicationTemplate.findUnique({
        where: { id: input.templateId },
      });
      if (!template) throw new NotFoundException('Template not found');
      subject = renderTemplate(template.subject, vars);
      body = renderTemplate(template.body, vars);
      templateId = template.id;
    } else {
      subject = renderTemplate(subject, vars);
      body = renderTemplate(body, vars);
    }
    if (!subject.trim() || !body.trim()) {
      throw new BadRequestException('Subject and body are required (or pick a template)');
    }

    await this.prisma.communicationLog.create({
      data: {
        candidateId,
        templateId,
        subject,
        body,
        sentById: actor.employeeId,
        visibleToCandidate: true,
      },
    });
    await this.addAudit({
      requisitionId: candidate.requisitionId ?? undefined,
      candidateId,
      actorId: actor.employeeId,
      event: 'COMM_SENT',
      detail: subject,
    });
    return this.getCandidateDetail(candidateId, actor);
  }

  /* ---------------------------- Templates ---------------------------- */

  private templateShape(row: {
    id: string;
    name: string;
    subject: string;
    body: string;
    trigger: unknown;
    isDefault: boolean;
  }): CommunicationTemplateEntry {
    return {
      id: row.id,
      name: row.name,
      subject: row.subject,
      body: row.body,
      trigger: triggerFromDb[row.trigger as keyof typeof triggerFromDb],
      isDefault: row.isDefault,
    };
  }

  async listTemplates(): Promise<CommunicationTemplateEntry[]> {
    const rows = await this.prisma.communicationTemplate.findMany({ orderBy: { name: 'asc' } });
    return rows.map((r) => this.templateShape(r));
  }

  async createTemplate(input: {
    name: string;
    subject: string;
    body: string;
    trigger: keyof typeof triggerToDb;
  }): Promise<CommunicationTemplateEntry[]> {
    await this.prisma.communicationTemplate.create({
      data: {
        name: input.name,
        subject: input.subject,
        body: input.body,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        trigger: triggerToDb[input.trigger] as any,
      },
    });
    return this.listTemplates();
  }

  async updateTemplate(
    id: string,
    input: { name?: string; subject?: string; body?: string; trigger?: keyof typeof triggerToDb },
  ): Promise<CommunicationTemplateEntry[]> {
    await this.prisma.communicationTemplate.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.subject !== undefined ? { subject: input.subject } : {}),
        ...(input.body !== undefined ? { body: input.body } : {}),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(input.trigger !== undefined ? { trigger: triggerToDb[input.trigger] as any } : {}),
      },
    });
    return this.listTemplates();
  }

  async deleteTemplate(id: string): Promise<CommunicationTemplateEntry[]> {
    await this.prisma.communicationTemplate.delete({ where: { id } });
    return this.listTemplates();
  }

  /* ---------------------------- Scorecards --------------------------- */

  /**
   * Replace the structured-interview criteria for a requisition. Customizable by
   * all parties involved — HR, the creator, or any hiring-team member (the guide
   * is shared), so interviewers can shape what they'll evaluate.
   */
  /* ------------------- Company standard interview guide ------------------- */

  /**
   * The editable company-wide standard guide. Empty table → the built-in
   * NinjaHR standard, so the feature works before HR ever customizes it.
   */
  async getGuideTemplate(): Promise<GuideSectionInput[]> {
    const rows = await this.prisma.guideTemplateSection.findMany({ orderBy: { order: 'asc' } });
    if (rows.length === 0) return DEFAULT_SCORECARD_SECTIONS;
    return rows.map((r) => ({
      name: r.name,
      weight: r.weight ?? undefined,
      guidance: r.guidance ?? undefined,
    }));
  }

  /** Replaces the company standard guide (HR-only at the route). */
  async setGuideTemplate(sections: GuideSectionInput[], actor: ActorContext): Promise<GuideSectionInput[]> {
    await this.prisma.$transaction([
      this.prisma.guideTemplateSection.deleteMany({}),
      this.prisma.guideTemplateSection.createMany({
        data: sections.map((s, i) => ({
          name: s.name,
          weight: s.weight ?? null,
          guidance: s.guidance ?? null,
          order: i,
        })),
      }),
    ]);
    await this.addAudit({ actorId: actor.employeeId, event: 'GUIDE_TEMPLATE_UPDATED', detail: `${sections.length} sections` });
    return this.getGuideTemplate();
  }

  async setScorecardCriteria(
    requisitionId: string,
    criteria: { name: string; weight?: number; guidance?: string }[],
    actor: ActorContext,
  ): Promise<RequisitionDetail> {
    const detail = await this.getDetail(requisitionId);
    const onTeam =
      detail.createdById === actor.employeeId ||
      detail.hiringTeam.some((m) => m.employeeId === actor.employeeId);
    if (actor.role !== 'HR_ADMIN' && !onTeam) {
      throw new ForbiddenException('Only the hiring team or HR can edit scorecard criteria');
    }
    await this.prisma.$transaction([
      this.prisma.scorecardCriterion.deleteMany({ where: { requisitionId } }),
      this.prisma.scorecardCriterion.createMany({
        data: criteria.map((c, i) => ({
          requisitionId,
          name: c.name,
          weight: c.weight ?? null,
          guidance: c.guidance ?? null,
          order: i,
        })),
      }),
    ]);
    await this.addAudit({
      requisitionId,
      actorId: actor.employeeId,
      event: 'CRITERIA_UPDATED',
      detail: `${criteria.length} criteria`,
    });
    return this.getDetail(requisitionId);
  }

  /**
   * Structured scorecard submission — panel members (and HR) only, one per
   * panelist per candidate (resubmitting replaces the previous scorecard).
   */
  async submitScorecard(
    candidateId: string,
    input: {
      recommendation: 'Strong Yes' | 'Yes' | 'No' | 'Strong No';
      overallNotes?: string;
      ratings: { criterionId: string; rating: number; notes?: string }[];
      // DRAFT = live note-taking during the interview; SUBMITTED = finalized.
      status?: 'DRAFT' | 'SUBMITTED';
    },
    actor: ActorContext,
  ): Promise<CandidateDetail> {
    const status = input.status ?? 'SUBMITTED';
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { requisitionId: true },
    });
    if (!candidate) throw new NotFoundException(`Candidate ${candidateId} not found`);
    if (!candidate.requisitionId) {
      throw new BadRequestException('Candidate is not linked to a requisition');
    }
    if (!actor.employeeId) throw new ForbiddenException('No employee identity');

    // Panel-only: HR may also submit, everyone else must be a panel member.
    if (actor.role !== 'HR_ADMIN') {
      const member = await this.prisma.hiringTeamMember.findFirst({
        where: {
          requisitionId: candidate.requisitionId,
          employeeId: actor.employeeId,
          isPanelMember: true,
        },
      });
      if (!member) throw new ForbiddenException('Only interview panel members can submit scorecards');
    }

    // Ratings must reference this requisition's criteria and stay within 1–5.
    const criteria = await this.prisma.scorecardCriterion.findMany({
      where: { requisitionId: candidate.requisitionId },
      select: { id: true },
    });
    const validIds = new Set(criteria.map((c) => c.id));
    for (const r of input.ratings) {
      if (!validIds.has(r.criterionId)) {
        throw new BadRequestException('Rating references a criterion from another requisition');
      }
      // Drafts may hold partial (0 = not-yet-rated) notes taken mid-interview;
      // a finalized submission must have every rating in 1–5.
      const min = status === 'SUBMITTED' ? 1 : 0;
      if (r.rating < min || r.rating > 5) {
        throw new BadRequestException(`Ratings must be between ${min} and 5`);
      }
    }

    const recommendationDb = {
      'Strong Yes': 'STRONG_YES',
      Yes: 'YES',
      No: 'NO',
      'Strong No': 'STRONG_NO',
    }[input.recommendation];

    await this.prisma.$transaction(async (tx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyTx = tx as any;
      const existing = await anyTx.scorecardSubmission.findUnique({
        where: {
          candidateId_panelistId: { candidateId, panelistId: actor.employeeId },
        },
      });
      if (existing) await anyTx.scorecardSubmission.delete({ where: { id: existing.id } });
      await anyTx.scorecardSubmission.create({
        data: {
          candidateId,
          panelistId: actor.employeeId,
          recommendation: recommendationDb,
          overallNotes: input.overallNotes ?? null,
          status,
          submittedAt: new Date(),
          ratings: {
            // Nested create — stamp explicitly (tenant extension skips these).
            create: input.ratings.map((r) => ({
              criterionId: r.criterionId,
              rating: r.rating,
              notes: r.notes ?? null,
              companyId: this.tenant.companyId,
            })),
          },
        },
      });
    });
    await this.addAudit({
      requisitionId: candidate.requisitionId,
      candidateId,
      actorId: actor.employeeId,
      event: status === 'SUBMITTED' ? 'SCORECARD_SUBMITTED' : 'SCORECARD_DRAFTED',
      detail: input.recommendation,
    });
    return this.getCandidateDetail(candidateId, actor);
  }

  /* ------------------------- Privacy compliance ---------------------- */

  /**
   * HR-only PII purge: anonymizes in place so funnel analytics keep their
   * integrity while all personal data is removed. Audited.
   */
  async purgeCandidate(candidateId: string, actor: ActorContext): Promise<CandidateDetail> {
    const row = await this.prisma.candidate.findUnique({ where: { id: candidateId } });
    if (!row) throw new NotFoundException(`Candidate ${candidateId} not found`);
    if (row.anonymizedAt) return this.getCandidateDetail(candidateId, actor); // idempotent

    await this.prisma.$transaction([
      this.prisma.candidate.update({
        where: { id: candidateId },
        data: {
          name: 'Candidate (redacted)',
          email: null,
          resumeText: null,
          portalToken: null, // tracking link stops resolving
          strengths: [],
          gaps: [],
          anonymizedAt: new Date(),
        },
      }),
      // Free-text answers may contain PII — remove them entirely.
      this.prisma.preScreenAnswer.deleteMany({ where: { candidateId } }),
      // The résumé file + parsed contact data is the densest PII — drop it.
      this.prisma.candidateResume.deleteMany({ where: { candidateId } }),
      // Internal notes may reference the person by name — remove them too.
      this.prisma.candidateNote.deleteMany({ where: { candidateId } }),
      // Rendered messages embed the candidate's name — redact the bodies.
      this.prisma.communicationLog.updateMany({
        where: { candidateId },
        data: { subject: '[redacted]', body: '[redacted at candidate request]' },
      }),
    ]);
    await this.addAudit({
      requisitionId: row.requisitionId ?? undefined,
      candidateId,
      actorId: actor.employeeId,
      event: 'PII_PURGED',
      detail: 'Personal data anonymized per Ontario privacy compliance',
    });
    return this.getCandidateDetail(candidateId, actor);
  }

  async setCostOfHire(requisitionId: string, cost: number, actor: ActorContext): Promise<RequisitionDetail> {
    await this.prisma.requisition.update({ where: { id: requisitionId }, data: { costOfHire: cost } });
    await this.addAudit({
      requisitionId,
      actorId: actor.employeeId,
      event: 'COST_UPDATED',
      detail: `$${cost}`,
    });
    return this.getDetail(requisitionId);
  }

  /* ----------------------------- Analytics --------------------------- */

  async getAnalytics(): Promise<RecruitmentAnalytics> {
    const [candidates, requisitions, hireEvents] = await Promise.all([
      this.prisma.candidate.findMany({
        select: {
          id: true,
          stage: true,
          source: true,
          requisitionId: true,
          interviewDate: true,
          withdrawnAt: true,
        },
      }),
      this.prisma.requisition.findMany({
        select: {
          id: true,
          title: true,
          department: true,
          openedDate: true,
          publishedAt: true,
          costOfHire: true,
        },
      }),
      this.prisma.recruitmentAuditEvent.findMany({
        where: { event: 'STAGE_CHANGED', detail: { endsWith: '→ Hired' } },
        orderBy: { at: 'asc' },
        select: { candidateId: true, at: true },
      }),
    ]);

    const stageOrder: CandidateStage[] = ['Applied', 'AI Screened', 'Interview', 'Offer', 'Hired', 'Rejected'];
    const funnel = stageOrder.map((stage) => ({
      stage,
      count: candidates.filter(
        (c) => candidateStageFromDb[c.stage as keyof typeof candidateStageFromDb] === stage,
      ).length,
    }));

    const sourceOrder: CandidateSource[] = ['Careers Site', 'Indeed', 'LinkedIn'];
    const sources = sourceOrder.map((source) => ({
      source,
      count: candidates.filter(
        (c) => (candidateSourceToDb[source] as string) === (c.source as string),
      ).length,
    }));

    const interviewed = candidates.filter(
      (c) => c.interviewDate !== null || ['INTERVIEW', 'OFFER', 'HIRED'].includes(c.stage as string),
    ).length;
    const applicants = candidates.length;

    // Time-to-fill: requisition opened → first candidate marked Hired (from
    // the audit trail, so legacy rows without events are excluded).
    const reqById = new Map(requisitions.map((r) => [r.id, r]));
    const candById = new Map(candidates.map((c) => [c.id, c]));
    const firstHireByReq = new Map<string, Date>();
    for (const ev of hireEvents) {
      const cand = ev.candidateId ? candById.get(ev.candidateId) : undefined;
      if (!cand?.requisitionId) continue;
      if (!firstHireByReq.has(cand.requisitionId)) firstHireByReq.set(cand.requisitionId, ev.at);
    }
    const timeToFill = [...firstHireByReq.entries()]
      .map(([reqId, hiredAt]) => {
        const req = reqById.get(reqId);
        if (!req) return null;
        const start = req.publishedAt ?? req.openedDate;
        return {
          requisition: req.title,
          department: req.department,
          days: Math.max(0, Math.round((hiredAt.getTime() - start.getTime()) / 86_400_000)),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    const avgTimeToFillDays = timeToFill.length
      ? Math.round(timeToFill.reduce((s, t) => s + t.days, 0) / timeToFill.length)
      : null;

    const hiredByReq = new Map<string, number>();
    for (const c of candidates) {
      if ((c.stage as string) === 'HIRED' && c.requisitionId) {
        hiredByReq.set(c.requisitionId, (hiredByReq.get(c.requisitionId) ?? 0) + 1);
      }
    }
    const costPerHire = requisitions
      .filter((r) => r.costOfHire != null)
      .map((r) => {
        const hires = hiredByReq.get(r.id) ?? 0;
        return {
          requisition: r.title,
          cost: r.costOfHire as number,
          hires,
          costPerHire: hires > 0 ? Math.round((r.costOfHire as number) / hires) : r.costOfHire as number,
        };
      });
    const avgCostPerHire = costPerHire.length
      ? Math.round(costPerHire.reduce((s, c) => s + c.costPerHire, 0) / costPerHire.length)
      : null;

    const deptMap = new Map<string, { applicants: number; hired: number }>();
    for (const c of candidates) {
      const dept = c.requisitionId ? (reqById.get(c.requisitionId)?.department ?? 'Unassigned') : 'Unassigned';
      const entry = deptMap.get(dept) ?? { applicants: 0, hired: 0 };
      entry.applicants += 1;
      if ((c.stage as string) === 'HIRED') entry.hired += 1;
      deptMap.set(dept, entry);
    }

    // Evaluation KPIs: aggregate submitted scorecards into avg interview score,
    // recommendation mix, and completion (candidates with ≥1 submitted card).
    const submittedCards = await this.prisma.scorecardSubmission.findMany({
      where: { status: 'SUBMITTED' },
      include: { ratings: true },
    });
    const allRatings = submittedCards.flatMap((s) => s.ratings.map((r) => r.rating)).filter((r) => r > 0);
    const avgInterviewScore = allRatings.length
      ? Math.round((allRatings.reduce((a, b) => a + b, 0) / allRatings.length) * 10) / 10
      : null;
    const recMix = ['STRONG_YES', 'YES', 'NO', 'STRONG_NO'].map((rec) => ({
      recommendation: recommendationFromDb[rec as keyof typeof recommendationFromDb],
      count: submittedCards.filter((s) => s.recommendation === rec).length,
    })).filter((m) => m.count > 0);
    const candidatesWithScorecard = new Set(submittedCards.map((s) => s.candidateId)).size;

    return {
      funnel,
      sources,
      applicantToInterview: {
        applicants,
        interviewed,
        ratioPct: applicants ? Math.round((interviewed / applicants) * 100) : 0,
      },
      timeToFill,
      avgTimeToFillDays,
      costPerHire,
      avgCostPerHire,
      byDepartment: [...deptMap.entries()].map(([department, v]) => ({ department, ...v })),
      withdrawnCount: candidates.filter((c) => c.withdrawnAt !== null).length,
      evaluation: {
        avgInterviewScore,
        scorecardsSubmitted: submittedCards.length,
        candidatesScored: candidatesWithScorecard,
        interviewedCandidates: interviewed,
        recommendationMix: recMix,
      },
    };
  }
}
