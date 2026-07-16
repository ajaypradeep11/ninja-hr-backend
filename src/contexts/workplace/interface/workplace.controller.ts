// src/contexts/workplace/interface/workplace.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ActorCtx, type ActorContext } from 'src/platform/auth/actor-context';
import { Roles } from 'src/platform/auth/roles.decorator';
import { GetVaultDocumentsQuery } from '../application/queries/get-vault-documents.query';
import { GetTrainingCoursesQuery } from '../application/queries/get-training-courses.query';
import {
  AssignTrainingCommand,
  CreateCourseCommand,
  CreatePeerCourseCommand,
  DeleteCourseCommand,
  DeletePeerCourseCommand,
  GetAllAssignmentsQuery,
  GetCourseAssignmentsQuery,
  GetMyCoursesQuery,
  GetMyTrainingQuery,
  UpdateAssignmentCommand,
  UpdateCourseCommand,
  UpdatePeerCourseCommand,
} from '../application/training.handlers';
import {
  CreateLetterTemplateCommand,
  DeleteLetterTemplateCommand,
  GetLetterTemplatesQuery,
  IssueLetterCommand,
  DraftLetterCommand,
  CreateMassLetterRunCommand,
  UpdateLetterTemplateCommand,
} from '../application/letters.handlers';
import { DeleteVaultDocumentCommand, GetVaultDocumentFileQuery, UploadVaultDocumentCommand } from '../application/documents.handlers';
import {
  AssignTrainingDto,
  CreateCourseDto,
  IssueLetterDto,
  DraftLetterDto,
  MassIssueLetterDto,
  LetterTemplateDto,
  PeerCourseDto,
  UpdateAssignmentDto,
  UpdateCourseDto,
  UpdateLetterTemplateDto,
  UpdatePeerCourseDto,
  UploadVaultDocumentDto,
} from './dto/workplace.dto';

@ApiTags('workplace')
@Controller('workplace')
export class WorkplaceController {
  constructor(
    private readonly queries: QueryBus,
    private readonly commands: CommandBus,
  ) {}

  /** Document vault. Scoped in the handler: non-HR viewers never see another
   *  employee's personal documents or anything above their clearance. */
  @Get('documents')
  getVaultDocuments(@ActorCtx() actor: ActorContext) {
    return this.queries.execute(new GetVaultDocumentsQuery(actor));
  }

  /** Manual vault upload (Documents dropzone). HR-only: employees receive
   *  documents through platform workflows, never by writing to the vault. */
  @Post('documents')
  @Roles('HR_ADMIN')
  uploadVaultDocument(@Body() body: UploadVaultDocumentDto) {
    return this.commands.execute(new UploadVaultDocumentCommand(body));
  }

  /** Streams a stored vault file — HR, or the owning employee. */
  @Get('documents/:id/file')
  async downloadVaultDocument(
    @Param('id') id: string,
    @ActorCtx() actor: ActorContext,
    @Res() res: Response,
  ) {
    const file = (await this.queries.execute(new GetVaultDocumentFileQuery(id, actor))) as {
      name: string;
      mimeType: string;
      data: Buffer;
    };
    const ascii = file.name.replace(/"/g, '').replace(/[^\x20-\x7E]/g, '-');
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    );
    res.send(file.data);
  }

  /** Remove a vault document — HR curates employee file cabinets. */
  @Delete('documents/:id')
  @Roles('HR_ADMIN')
  deleteVaultDocument(@Param('id') id: string) {
    return this.commands.execute(new DeleteVaultDocumentCommand(id));
  }

  /* ---------------------- Letter Lab (HR letters) -------------------- */

  // Managers can read templates + issue letters for their reports (e.g.
  // probation letters from the Milestone Tracker); editing stays HR-only.
  @Get('letter-templates')
  @Roles('HR_ADMIN', 'MANAGER')
  getLetterTemplates() {
    return this.queries.execute(new GetLetterTemplatesQuery());
  }

  @Post('letter-templates')
  @Roles('HR_ADMIN')
  createLetterTemplate(@Body() body: LetterTemplateDto) {
    return this.commands.execute(new CreateLetterTemplateCommand(body));
  }

  @Patch('letter-templates/:id')
  @Roles('HR_ADMIN')
  updateLetterTemplate(@Param('id') id: string, @Body() body: UpdateLetterTemplateDto) {
    return this.commands.execute(new UpdateLetterTemplateCommand(id, body));
  }

  @Delete('letter-templates/:id')
  @Roles('HR_ADMIN')
  deleteLetterTemplate(@Param('id') id: string) {
    return this.commands.execute(new DeleteLetterTemplateCommand(id));
  }

  /** File a generated letter into the employee's vault (save / e-signature). */
  @Post('letters/issue')
  @Roles('HR_ADMIN', 'MANAGER')
  issueLetter(@Body() body: IssueLetterDto, @ActorCtx() actor: ActorContext) {
    return this.commands.execute(new IssueLetterCommand(body, actor));
  }

  @Post('letters/draft')
  @Roles('HR_ADMIN', 'MANAGER')
  draftLetter(@Body() body: DraftLetterDto, @ActorCtx() actor: ActorContext) {
    return this.commands.execute(new DraftLetterCommand(body, actor));
  }

  /** Queues drafts for review; it deliberately does not issue vault documents. */
  @Post('letters/mass-issue')
  @Roles('HR_ADMIN')
  massIssue(@Body() body: MassIssueLetterDto, @ActorCtx() actor: ActorContext) {
    return this.commands.execute(new CreateMassLetterRunCommand(body as never, actor));
  }

  /* ------------------------- Training catalog ------------------------ */

  @Get('training-courses')
  getTrainingCourses() {
    return this.queries.execute(new GetTrainingCoursesQuery());
  }

  @Post('training-courses')
  @Roles('HR_ADMIN')
  createCourse(@Body() body: CreateCourseDto) {
    return this.commands.execute(new CreateCourseCommand(body));
  }

  @Patch('training-courses/:id')
  @Roles('HR_ADMIN')
  updateCourse(@Param('id') id: string, @Body() body: UpdateCourseDto) {
    return this.commands.execute(new UpdateCourseCommand(id, body));
  }

  @Delete('training-courses/:id')
  @Roles('HR_ADMIN')
  deleteCourse(@Param('id') id: string) {
    return this.commands.execute(new DeleteCourseCommand(id));
  }

  @Get('training-courses/:id/assignments')
  @Roles('HR_ADMIN')
  getCourseAssignments(@Param('id') id: string) {
    return this.queries.execute(new GetCourseAssignmentsQuery(id));
  }

  /* ---------------------- Peer-created courses ---------------------- */
  // Any employee can build a course; it flows Draft → Pending HR Approval →
  // Published/Rejected. Ownership is enforced in the repository.

  /** The actor's own created courses (Creator Studio). */
  @Get('my-courses')
  getMyCourses(@ActorCtx() actor: ActorContext) {
    return this.queries.execute(new GetMyCoursesQuery(actor));
  }

  @Post('my-courses')
  createPeerCourse(@Body() body: PeerCourseDto, @ActorCtx() actor: ActorContext) {
    return this.commands.execute(new CreatePeerCourseCommand(body, actor));
  }

  /** Edit own unpublished course; `submit: true` sends it for HR approval. */
  @Patch('my-courses/:id')
  updatePeerCourse(
    @Param('id') id: string,
    @Body() body: UpdatePeerCourseDto,
    @ActorCtx() actor: ActorContext,
  ) {
    return this.commands.execute(new UpdatePeerCourseCommand(id, body, actor));
  }

  @Delete('my-courses/:id')
  deletePeerCourse(@Param('id') id: string, @ActorCtx() actor: ActorContext) {
    return this.commands.execute(new DeletePeerCourseCommand(id, actor));
  }

  /* --------------------------- Assignments --------------------------- */

  /** HR assigns a course to selected employees. */
  @Post('training-assignments')
  @Roles('HR_ADMIN')
  assignTraining(@Body() body: AssignTrainingDto) {
    return this.commands.execute(new AssignTrainingCommand(body));
  }

  /** All assignments — the compliance Tracker (HR). */
  @Get('training-assignments')
  @Roles('HR_ADMIN')
  getAllAssignments() {
    return this.queries.execute(new GetAllAssignmentsQuery());
  }

  /** The current user's assigned training. */
  @Get('my-training')
  getMyTraining(@ActorCtx() actor: ActorContext) {
    return this.queries.execute(new GetMyTrainingQuery(actor));
  }

  /** Update progress/status — employees own their own; HR any. */
  @Patch('training-assignments/:id')
  updateAssignment(
    @Param('id') id: string,
    @Body() body: UpdateAssignmentDto,
    @ActorCtx() actor: ActorContext,
  ) {
    return this.commands.execute(new UpdateAssignmentCommand(id, body, actor));
  }
}
