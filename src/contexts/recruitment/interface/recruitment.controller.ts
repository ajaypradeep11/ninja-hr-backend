// src/contexts/recruitment/interface/recruitment.controller.ts
import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ActorCtx, type ActorContext } from 'src/platform/auth/actor-context';
import { Roles } from 'src/platform/auth/roles.decorator';
import { GetRequisitionsQuery } from '../application/queries/get-requisitions.query';
import { GetRequisitionDetailQuery } from '../application/queries/get-requisition-detail.query';
import { GetRequisitionCandidatesQuery } from '../application/queries/get-requisition-candidates.query';
import { GetCandidatesQuery } from '../application/queries/get-candidates.query';
import { GetJobsQuery } from '../application/queries/get-jobs.query';
import { GetJobBySlugQuery } from '../application/queries/get-job-by-slug.query';
import { GetPortalViewQuery } from '../application/queries/get-portal-view.query';
import { ApplyToJobCommand } from '../application/commands/apply-to-job.command';
import { WithdrawApplicationCommand } from '../application/commands/withdraw-application.command';
import { GetCandidateDetailQuery } from '../application/queries/get-candidate-detail.query';
import { GetResumeFileQuery, type ResumeFile } from '../application/queries/get-resume-file.query';
import { GetAssignedCandidatesQuery } from '../application/queries/get-assigned-candidates.query';
import { AddNoteCommand } from '../application/commands/add-note.command';
import { GetTemplatesQuery } from '../application/queries/get-templates.query';
import { SendCommunicationCommand } from '../application/commands/send-communication.command';
import {
  CreateTemplateCommand,
  DeleteTemplateCommand,
  UpdateTemplateCommand,
} from '../application/commands/template-crud.commands';
import { SetScorecardCriteriaCommand } from '../application/commands/set-scorecard-criteria.command';
import { SubmitScorecardCommand } from '../application/commands/submit-scorecard.command';
import { GetAnalyticsQuery } from '../application/queries/get-analytics.query';
import { PurgeCandidateCommand } from '../application/commands/purge-candidate.command';
import { SetCostCommand } from '../application/commands/set-cost.command';
import { GenerateJdCommand } from '../application/commands/generate-jd.command';
import { ArchiveRequisitionCommand } from '../application/commands/archive-requisition.command';
import { DraftMessageCommand } from '../application/commands/draft-message.command';
import {
  GetGuideTemplateQuery,
  ImportGuideCommand,
  SetGuideTemplateCommand,
} from '../application/commands/guide-template.commands';
import { RecordInboundCommand } from '../application/commands/record-inbound.command';
import { DeleteRequisitionCommand } from '../application/commands/delete-requisition.command';
import { CreateRequisitionCommand } from '../application/commands/create-requisition.command';
import { UpdateRequisitionCommand } from '../application/commands/update-requisition.command';
import { SubmitRequisitionCommand } from '../application/commands/submit-requisition.command';
import { DecideRequisitionCommand } from '../application/commands/decide-requisition.command';
import { UpdatePublishingCommand } from '../application/commands/update-publishing.command';
import { PublishRequisitionCommand } from '../application/commands/publish-requisition.command';
import { SetCandidateStageCommand } from '../application/commands/set-candidate-stage.command';
import {
  AddNoteDto,
  ApplyDto,
  ArchiveRequisitionDto,
  CreateRequisitionDto,
  DecisionDto,
  DraftMessageDto,
  GenerateJdDto,
  ImportGuideDto,
  InboundEmailDto,
  SetGuideTemplateDto,
  SimulateReplyDto,
  PublishingDto,
  SendCommunicationDto,
  SetCandidateStageDto,
  SetCostDto,
  SetScorecardCriteriaDto,
  SubmitScorecardDto,
  TemplateDto,
  UpdateTemplateDto,
} from './dto/recruitment.dto';

@ApiTags('recruitment')
@Controller('recruitment')
export class RecruitmentController {
  constructor(
    private readonly queries: QueryBus,
    private readonly commands: CommandBus,
  ) {}

  /* --------------------------- Requisitions -------------------------- */

  /** HR sees all; managers see the requisitions they created, approve, or staff. */
  @Get('requisitions')
  @Roles('HR_ADMIN', 'MANAGER')
  getRequisitions(
    @ActorCtx() actor: ActorContext,
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.queries.execute(new GetRequisitionsQuery(actor, includeArchived === 'true'));
  }

  /** Archive or restore a requisition (HR). Archived roles drop off lists + careers. */
  @Post('requisitions/:id/archive')
  @Roles('HR_ADMIN')
  archiveRequisition(
    @Param('id') id: string,
    @Body() body: ArchiveRequisitionDto,
    @ActorCtx() actor: ActorContext,
  ) {
    return this.commands.execute(new ArchiveRequisitionCommand(id, body.archived, actor));
  }

  /** Permanently delete a requisition and everything under it (HR). */
  @Delete('requisitions/:id')
  @Roles('HR_ADMIN')
  deleteRequisition(@Param('id') id: string, @ActorCtx() actor: ActorContext) {
    return this.commands.execute(new DeleteRequisitionCommand(id, actor));
  }

  /** Creates a DRAFT requisition with approvers + hiring team. Not published. */
  @Post('requisitions')
  @Roles('HR_ADMIN', 'MANAGER')
  createRequisition(@Body() body: CreateRequisitionDto, @ActorCtx() actor: ActorContext) {
    return this.commands.execute(
      new CreateRequisitionCommand(
        {
          title: body.title,
          department: body.department,
          province: body.province,
          type: body.type,
          salaryMin: body.salaryMin,
          salaryMax: body.salaryMax,
          jd: body.jd,
          approverIds: body.approverIds,
          hiringTeam: body.hiringTeam,
        },
        actor,
      ),
    );
  }

  @Get('requisitions/:id')
  @Roles('HR_ADMIN', 'MANAGER')
  getRequisitionDetail(@Param('id') id: string, @ActorCtx() actor: ActorContext) {
    return this.queries.execute(new GetRequisitionDetailQuery(id, actor));
  }

  /** Edit while Draft (creator or HR only — enforced in the handler). */
  @Patch('requisitions/:id')
  @Roles('HR_ADMIN', 'MANAGER')
  updateRequisition(
    @Param('id') id: string,
    @Body() body: CreateRequisitionDto,
    @ActorCtx() actor: ActorContext,
  ) {
    return this.commands.execute(
      new UpdateRequisitionCommand(
        id,
        {
          title: body.title,
          department: body.department,
          province: body.province,
          type: body.type,
          salaryMin: body.salaryMin,
          salaryMax: body.salaryMax,
          jd: body.jd,
          approverIds: body.approverIds,
          hiringTeam: body.hiringTeam,
        },
        actor,
      ),
    );
  }

  /** Draft → Pending Approval (resets prior decisions). */
  @Post('requisitions/:id/submit')
  @Roles('HR_ADMIN', 'MANAGER')
  submitRequisition(@Param('id') id: string, @ActorCtx() actor: ActorContext) {
    return this.commands.execute(new SubmitRequisitionCommand(id, actor));
  }

  /** Named approvers approve/reject; all-approved → Approved, reject → Draft. */
  @Post('requisitions/:id/decision')
  @Roles('HR_ADMIN', 'MANAGER')
  decideRequisition(
    @Param('id') id: string,
    @Body() body: DecisionDto,
    @ActorCtx() actor: ActorContext,
  ) {
    return this.commands.execute(new DecideRequisitionCommand(id, actor, body.decision, body.comment));
  }

  /** HR publishing prep: JD, pre-screening questions, job-board toggles. */
  @Patch('requisitions/:id/publishing')
  @Roles('HR_ADMIN')
  updatePublishing(
    @Param('id') id: string,
    @Body() body: PublishingDto,
    @ActorCtx() actor: ActorContext,
  ) {
    return this.commands.execute(new UpdatePublishingCommand(id, body, actor));
  }

  /** Approved → Published (slug + simulated Indeed/LinkedIn deep-links). */
  @Post('requisitions/:id/publish')
  @Roles('HR_ADMIN')
  publishRequisition(@Param('id') id: string, @ActorCtx() actor: ActorContext) {
    return this.commands.execute(new PublishRequisitionCommand(id, actor));
  }

  /** Candidates of one requisition — HR + hiring team only. */
  @Get('requisitions/:id/candidates')
  @Roles('HR_ADMIN', 'MANAGER')
  getRequisitionCandidates(@Param('id') id: string, @ActorCtx() actor: ActorContext) {
    return this.queries.execute(new GetRequisitionCandidatesQuery(id, actor));
  }

  /* ---------------------------- Candidates --------------------------- */

  @Get('candidates')
  @Roles('HR_ADMIN')
  getCandidates() {
    return this.queries.execute(new GetCandidatesQuery());
  }

  /** Candidates the actor is assigned to evaluate (hiring-team member). */
  @Get('assigned-candidates')
  getAssignedCandidates(@ActorCtx() actor: ActorContext) {
    return this.queries.execute(new GetAssignedCandidatesQuery(actor));
  }

  // Candidate-scoped routes below intentionally carry NO @Roles gate: access is
  // enforced row-by-row via assertCandidateAccess (HR, or a hiring-team member
  // of that candidate's requisition), so panelists who are plain employees can
  // reach exactly their candidates while everyone else is blocked.

  /**
   * Stage change — fires template triggers (Interview invite, Rejection).
   * Admin-only: managers/panelists get a read-only pipeline; their input is
   * the scorecard. (Also keeps the Anti-Bias Shield's human-rejection rule
   * concentrated on one accountable role.)
   */
  @Patch('candidates/:id/stage')
  @Roles('HR_ADMIN')
  setCandidateStage(
    @Param('id') id: string,
    @Body() body: SetCandidateStageDto,
    @ActorCtx() actor: ActorContext,
  ) {
    return this.commands.execute(new SetCandidateStageCommand(id, body.stage, actor));
  }

  /** Full candidate profile: answers, communications, scorecards, notes, audit. */
  @Get('candidates/:id')
  getCandidateDetail(@Param('id') id: string, @ActorCtx() actor: ActorContext) {
    return this.queries.execute(new GetCandidateDetailQuery(id, actor));
  }

  /** Internal evaluation notes — hiring team + HR. Never candidate-facing. */
  @Post('candidates/:id/notes')
  addNote(
    @Param('id') id: string,
    @Body() body: AddNoteDto,
    @ActorCtx() actor: ActorContext,
  ) {
    return this.commands.execute(new AddNoteCommand(id, body.body, actor));
  }

  /**
   * AI drafting assistant for the composer — returns {subject, body} for HUMAN
   * review; never sends. HR-only, matching the manual-comms policy.
   */
  @Post('candidates/:id/draft-message')
  @Roles('HR_ADMIN')
  draftMessage(
    @Param('id') id: string,
    @Body() body: DraftMessageDto,
    @ActorCtx() actor: ActorContext,
  ) {
    return this.commands.execute(new DraftMessageCommand(id, body.instruction, actor));
  }

  /**
   * Inbound-email webhook (two-way mailbox). Point SendGrid Inbound Parse /
   * SES→SNS at this route; the To: address carries the candidate's portal
   * token (reply+<token>@mail domain). In production, swap the internal-key
   * header for provider signature verification (e.g. SendGrid's signed webhook
   * or SNS message signing) at the gateway.
   */
  @Post('comms/inbound')
  inboundEmail(@Body() body: InboundEmailDto) {
    const token = /reply\+([A-Za-z0-9_-]+)@/.exec(body.to)?.[1];
    if (!token) throw new BadRequestException('Unroutable To: address — expected reply+<token>@…');
    return this.commands.execute(
      new RecordInboundCommand(
        { portalToken: token },
        { from: body.from, subject: body.subject, body: body.text },
      ),
    );
  }

  /** Demo helper: inject a candidate reply without a mail provider (HR-only). */
  @Post('candidates/:id/simulate-reply')
  @Roles('HR_ADMIN')
  simulateReply(@Param('id') id: string, @Body() body: SimulateReplyDto) {
    return this.commands.execute(
      new RecordInboundCommand({ candidateId: id }, { subject: body.subject, body: body.body }),
    );
  }

  /**
   * Stream the stored résumé file (RBAC via assertCandidateAccess).
   * `?inline=true` renders in-browser (in-app viewer); default stays a download.
   */
  @Get('candidates/:id/resume')
  async downloadResume(
    @Param('id') id: string,
    @ActorCtx() actor: ActorContext,
    @Res() res: Response,
    @Query('inline') inline?: string,
  ) {
    const file = (await this.queries.execute(new GetResumeFileQuery(id, actor))) as ResumeFile;
    const disposition = inline === 'true' ? 'inline' : 'attachment';
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `${disposition}; filename="${file.fileName.replace(/"/g, '')}"`);
    res.send(file.data);
  }

  /**
   * Manual candidate-facing message — HR ONLY. The hiring team can add internal
   * notes and move stages, but only HR contacts candidates, for a consistent
   * employer brand. (Automated templated triggers stay system-generated.)
   */
  @Post('candidates/:id/communications')
  @Roles('HR_ADMIN')
  sendCommunication(
    @Param('id') id: string,
    @Body() body: SendCommunicationDto,
    @ActorCtx() actor: ActorContext,
  ) {
    return this.commands.execute(new SendCommunicationCommand(id, body, actor));
  }

  /* ------------------ Company standard interview guide ------------------ */

  /** The company's editable standard interview guide (falls back to built-in). */
  @Get('guide-template')
  @Roles('HR_ADMIN', 'MANAGER')
  getGuideTemplate() {
    return this.queries.execute(new GetGuideTemplateQuery());
  }

  /** Replace the standard guide — every NEW requisition inherits it. */
  @Put('guide-template')
  @Roles('HR_ADMIN')
  setGuideTemplate(@Body() body: SetGuideTemplateDto, @ActorCtx() actor: ActorContext) {
    return this.commands.execute(new SetGuideTemplateCommand(body.sections, actor));
  }

  /**
   * Import an existing interview document into guide sections (AI when a key
   * is configured, deterministic heading/question parser otherwise). Returns
   * the parsed sections for review — nothing is saved here.
   */
  @Post('guide-template/import')
  @Roles('HR_ADMIN')
  importGuide(@Body() body: ImportGuideDto) {
    return this.commands.execute(new ImportGuideCommand(body.text));
  }

  /** Structured-interview criteria — customizable by any hiring-team member or
   *  HR (repo enforces membership), so no role gate here. */
  @Put('requisitions/:id/scorecard-criteria')
  setScorecardCriteria(
    @Param('id') id: string,
    @Body() body: SetScorecardCriteriaDto,
    @ActorCtx() actor: ActorContext,
  ) {
    return this.commands.execute(new SetScorecardCriteriaCommand(id, body.criteria, actor));
  }

  /** Panel members save/submit structured scorecards (repo enforces panel membership). */
  @Post('candidates/:id/scorecards')
  submitScorecard(
    @Param('id') id: string,
    @Body() body: SubmitScorecardDto,
    @ActorCtx() actor: ActorContext,
  ) {
    return this.commands.execute(
      new SubmitScorecardCommand(
        id,
        {
          recommendation: body.recommendation,
          overallNotes: body.overallNotes,
          ratings: body.ratings,
          status: body.status,
        },
        actor,
      ),
    );
  }

  /** Manual cost-of-hire entry for the analytics dashboard (HR). */
  @Patch('requisitions/:id/cost')
  @Roles('HR_ADMIN')
  setCost(@Param('id') id: string, @Body() body: SetCostDto, @ActorCtx() actor: ActorContext) {
    return this.commands.execute(new SetCostCommand(id, body.costOfHire, actor));
  }

  /** Ontario privacy compliance: anonymize a candidate's PII in place (HR). */
  @Post('candidates/:id/purge')
  @Roles('HR_ADMIN')
  purgeCandidate(@Param('id') id: string, @ActorCtx() actor: ActorContext) {
    return this.commands.execute(new PurgeCandidateCommand(id, actor));
  }

  /** KPI aggregate: funnel, sources, time-to-fill, cost-per-hire, ratios. */
  @Get('analytics')
  @Roles('HR_ADMIN')
  getAnalytics() {
    return this.queries.execute(new GetAnalyticsQuery());
  }

  /** AI job-description generator (template fallback + inclusive-language flags). */
  @Post('jd/generate')
  @Roles('HR_ADMIN', 'MANAGER')
  generateJd(@Body() body: GenerateJdDto) {
    return this.commands.execute(new GenerateJdCommand(body));
  }

  /* ----------------------- Communication templates -------------------- */

  @Get('templates')
  @Roles('HR_ADMIN', 'MANAGER')
  getTemplates() {
    return this.queries.execute(new GetTemplatesQuery());
  }

  @Post('templates')
  @Roles('HR_ADMIN')
  createTemplate(@Body() body: TemplateDto) {
    return this.commands.execute(new CreateTemplateCommand(body));
  }

  @Patch('templates/:id')
  @Roles('HR_ADMIN')
  updateTemplate(@Param('id') id: string, @Body() body: UpdateTemplateDto) {
    return this.commands.execute(new UpdateTemplateCommand(id, body));
  }

  @Delete('templates/:id')
  @Roles('HR_ADMIN')
  deleteTemplate(@Param('id') id: string) {
    return this.commands.execute(new DeleteTemplateCommand(id));
  }

  /* --------------- Public job board (served via the BFF) -------------- */

  /** Published postings — powers both the internal board and the careers site. */
  @Get('jobs')
  getJobs() {
    return this.queries.execute(new GetJobsQuery());
  }

  @Get('jobs/:slug')
  getJobBySlug(@Param('slug') slug: string) {
    return this.queries.execute(new GetJobBySlugQuery(slug));
  }

  /** Careers-page application — consent required; returns the portal token. */
  @Post('jobs/:slug/apply')
  applyToJob(@Param('slug') slug: string, @Body() body: ApplyDto) {
    return this.commands.execute(
      new ApplyToJobCommand(slug, {
        name: body.name,
        email: body.email,
        resumeText: body.resumeText,
        resumeFileBase64: body.resumeFileBase64,
        resumeFileName: body.resumeFileName,
        resumeMimeType: body.resumeMimeType,
        source: body.source ?? 'Careers Site',
        answers: body.answers,
      }),
    );
  }

  /* --------------------------- Candidate portal ----------------------- */

  @Get('portal/by-token/:token')
  getPortalView(@Param('token') token: string) {
    return this.queries.execute(new GetPortalViewQuery(token));
  }

  @Post('portal/by-token/:token/withdraw')
  withdrawApplication(@Param('token') token: string) {
    return this.commands.execute(new WithdrawApplicationCommand(token));
  }
}
