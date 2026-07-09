// src/contexts/onboarding/interface/onboarding.controller.ts
import { Body, Controller, Get, Ip, Param, Patch, Post, Put, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ListCasesQuery } from '../application/queries/list-cases.query';
import { GetPipelineQuery } from '../application/queries/get-pipeline.query';
import { GetCaseByTokenQuery } from '../application/queries/get-case-by-token.query';
import { CreateCaseCommand } from '../application/commands/create-case.command';
import { MarkFormCommand } from '../application/commands/mark-form.command';
import { AddConsentCommand } from '../application/commands/add-consent.command';
import { FinalizeSubmissionCommand } from '../application/commands/finalize-submission.command';
import { SetChecklistCommand } from '../application/commands/set-checklist.command';
import { SetTaskStatusCommand } from '../application/commands/set-task-status.command';
import { VerifyDocumentCommand } from '../application/commands/verify-document.command';
import { TogglePolicyCommand } from '../application/commands/toggle-policy.command';
import { ActivateCommand } from '../application/commands/activate.command';
import { SubmitProfileCommand } from '../application/commands/submit-profile.command';
import { UploadCaseDocumentCommand } from '../application/commands/upload-case-document.command';
import { GetCaseDocumentFileQuery, type CaseDocumentFile } from '../application/queries/get-case-document-file.query';
import { SetTaskAssigneeCommand } from '../application/commands/set-task-assignee.command';
import {
  NewCaseDto, NewHireProfileDto, PolicyDto, TaskStatusDto, ChecklistDto, UploadCaseDocumentDto,
  SetTaskAssigneeDto,
} from './dto/onboarding.dto';
import type { FormFlags } from '../domain/onboarding.types';

@ApiTags('onboarding')
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly queries: QueryBus, private readonly commands: CommandBus) {}

  @Get('cases')
  listCases() {
    return this.queries.execute(new ListCasesQuery());
  }

  @Get('pipeline')
  pipeline() {
    return this.queries.execute(new GetPipelineQuery());
  }

  @Post('cases')
  createCase(@Body() body: NewCaseDto) {
    return this.commands.execute(new CreateCaseCommand(body));
  }

  /** Looks up a case by its invite token — backs `/welcome/:token` (new hire
   * has no session yet, so this is only ever called over the internal-key
   * lane). Returns null for an unknown/expired token. */
  @Get('cases/by-token/:token')
  getByToken(@Param('token') token: string) {
    return this.queries.execute(new GetCaseByTokenQuery(token));
  }

  @Post('cases/by-token/:token/forms/:key')
  markForm(@Param('token') token: string, @Param('key') key: keyof FormFlags) {
    return this.commands.execute(new MarkFormCommand(token, key));
  }

  /** Standard new-hire form (Ontario) — validated, stored, SIN/bank masked on read. */
  @Post('cases/by-token/:token/profile')
  submitProfile(@Param('token') token: string, @Body() body: NewHireProfileDto) {
    return this.commands.execute(new SubmitProfileCommand(token, body));
  }

  /**
   * Preboarding document upload (TD1/TD1ON, benefits enrollment, manual ack).
   * Auto-routes into the case's Documents + HR verification queue.
   */
  @Post('cases/by-token/:token/documents')
  uploadDocument(@Param('token') token: string, @Body() body: UploadCaseDocumentDto) {
    return this.commands.execute(
      new UploadCaseDocumentCommand(token, body.kind, body.fileName, body.mimeType, body.dataBase64),
    );
  }

  /** Download an uploaded preboarding file (HR verification). */
  @Get('cases/:id/documents/:docId/file')
  async downloadDocument(
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Res() res: Response,
  ) {
    const file = (await this.queries.execute(new GetCaseDocumentFileQuery(id, docId))) as CaseDocumentFile;
    // Header values must be Latin-1: ASCII fallback + RFC 5987 encoded original
    // (document names contain em dashes).
    const ascii = file.name.replace(/"/g, '').replace(/[^\x20-\x7E]/g, '-');
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    );
    res.send(file.data);
  }

  @Post('cases/by-token/:token/consent')
  addConsent(@Param('token') token: string, @Body() body: PolicyDto, @Ip() ip: string) {
    return this.commands.execute(new AddConsentCommand(token, body.policy, ip));
  }

  @Post('cases/by-token/:token/finalize')
  finalize(@Param('token') token: string, @Ip() ip: string) {
    return this.commands.execute(new FinalizeSubmissionCommand(token, ip));
  }

  @Put('cases/:id/checklist')
  setChecklist(@Param('id') id: string, @Body() body: ChecklistDto) {
    return this.commands.execute(new SetChecklistCommand(id, body.tasks));
  }

  /** Assign an internal employee to own a department's task block. */
  @Patch('cases/:id/assignees')
  setTaskAssignee(@Param('id') id: string, @Body() body: SetTaskAssigneeDto) {
    return this.commands.execute(new SetTaskAssigneeCommand(id, body.owner, body.employeeName));
  }

  @Patch('cases/:id/tasks/:taskId')
  setTaskStatus(@Param('id') id: string, @Param('taskId') taskId: string, @Body() body: TaskStatusDto) {
    return this.commands.execute(new SetTaskStatusCommand(id, taskId, body.status));
  }

  @Post('cases/:id/documents/:docId/verify')
  verifyDocument(@Param('id') id: string, @Param('docId') docId: string) {
    return this.commands.execute(new VerifyDocumentCommand(id, docId));
  }

  @Post('cases/:id/policies/toggle')
  togglePolicy(@Param('id') id: string, @Body() body: PolicyDto) {
    return this.commands.execute(new TogglePolicyCommand(id, body.policy));
  }

  @Post('cases/:id/activate')
  activate(@Param('id') id: string) {
    return this.commands.execute(new ActivateCommand(id));
  }
}
