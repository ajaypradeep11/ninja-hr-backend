// src/contexts/onboarding/interface/onboarding.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ListCasesQuery } from '../application/queries/list-cases.query';
import { GetPipelineQuery } from '../application/queries/get-pipeline.query';
import { CreateCaseCommand } from '../application/commands/create-case.command';
import { MarkFormCommand } from '../application/commands/mark-form.command';
import { AddConsentCommand } from '../application/commands/add-consent.command';
import { FinalizeSubmissionCommand } from '../application/commands/finalize-submission.command';
import { SetChecklistCommand } from '../application/commands/set-checklist.command';
import { SetTaskStatusCommand } from '../application/commands/set-task-status.command';
import { VerifyDocumentCommand } from '../application/commands/verify-document.command';
import { TogglePolicyCommand } from '../application/commands/toggle-policy.command';
import { ActivateCommand } from '../application/commands/activate.command';
import { NewCaseDto, PolicyDto, TaskStatusDto, ChecklistDto } from './dto/onboarding.dto';
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

  @Post('cases/by-token/:token/forms/:key')
  markForm(@Param('token') token: string, @Param('key') key: keyof FormFlags) {
    return this.commands.execute(new MarkFormCommand(token, key));
  }

  @Post('cases/by-token/:token/consent')
  addConsent(@Param('token') token: string, @Body() body: PolicyDto) {
    return this.commands.execute(new AddConsentCommand(token, body.policy));
  }

  @Post('cases/by-token/:token/finalize')
  finalize(@Param('token') token: string) {
    return this.commands.execute(new FinalizeSubmissionCommand(token));
  }

  @Put('cases/:id/checklist')
  setChecklist(@Param('id') id: string, @Body() body: ChecklistDto) {
    return this.commands.execute(new SetChecklistCommand(id, body.tasks));
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
