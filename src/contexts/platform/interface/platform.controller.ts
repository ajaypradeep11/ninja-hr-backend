// src/contexts/platform/interface/platform.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { GetSettingsQuery } from '../application/queries/get-settings.query';
import { GetAgentRunsQuery } from '../application/queries/get-agent-runs.query';
import { GetModerationEventsQuery } from '../application/queries/get-moderation-events.query';
import { ActorCtx, type ActorContext } from 'src/platform/auth/actor-context';
import { AskCopilotQuery } from '../application/queries/ask-copilot.query';
import { SaveSettingsCommand } from '../application/commands/save-settings.command';
import { CreateAgentRunCommand } from '../application/commands/create-agent-run.command';
import { SetAgentRunStatusCommand } from '../application/commands/set-agent-run-status.command';
import { DeletePolicyDocumentCommand } from '../application/commands/delete-policy-document.command';
import { RetryPolicyIngestionCommand } from '../application/commands/retry-policy-ingestion.command';
import { UploadPolicyDocumentCommand } from '../application/commands/upload-policy-document.command';
import { GetPolicyDocumentsQuery } from '../application/queries/get-policy-documents.query';
import {
  CreateCalcRuleCommand,
  DeleteCalcRuleCommand,
  GetCalcRulesQuery,
  UpdateCalcRuleCommand,
} from '../application/calc.handlers';
import {
  SaveSettingsDto,
  CreateAgentRunDto,
  SetAgentRunStatusDto,
  AskCopilotDto,
  CalcRuleDto,
  UpdateCalcRuleDto,
  ListModerationEventsDto,
  UploadPolicyDocumentDto,
  SendChatMessageDto,
} from './dto/platform.dto';
import { Actor } from 'src/platform/auth/actor.decorator';
import type { Persona } from 'src/platform/auth/actor.decorator';
import { Roles } from 'src/platform/auth/roles.decorator';
import { GetConversationsQuery } from '../application/queries/get-conversations.query';
import { CreateConversationCommand } from '../application/commands/create-conversation.command';
import { DeleteConversationCommand } from '../application/commands/delete-conversation.command';
import { SendChatMessageCommand } from '../application/commands/send-chat-message.command';

@ApiTags('platform')
@Controller('platform')
export class PlatformController {
  constructor(
    private readonly queries: QueryBus,
    private readonly commands: CommandBus,
  ) {}

  @Get('settings')
  getSettings() {
    return this.queries.execute(new GetSettingsQuery());
  }

  @Put('settings')
  @Roles('HR_ADMIN')
  saveSettings(@Body() body: SaveSettingsDto) {
    return this.commands.execute(new SaveSettingsCommand(body));
  }

  @Get('agent-runs')
  @Roles('HR_ADMIN')
  getAgentRuns() {
    return this.queries.execute(new GetAgentRunsQuery());
  }

  @Post('agent-runs')
  @Roles('HR_ADMIN')
  createAgentRun(@Body() body: CreateAgentRunDto) {
    return this.commands.execute(new CreateAgentRunCommand(body.intent));
  }

  @Patch('agent-runs/:id/status')
  @Roles('HR_ADMIN')
  setAgentRunStatus(@Param('id') id: string, @Body() body: SetAgentRunStatusDto) {
    return this.commands.execute(new SetAgentRunStatusCommand(id, body.status));
  }

  @Get('moderation-events')
  @Roles('HR_ADMIN')
  getModerationEvents(@Query() query: ListModerationEventsDto) {
    return this.queries.execute(new GetModerationEventsQuery(query.limit));
  }

  @Post('copilot/ask')
  askCopilot(
    @Body() body: AskCopilotDto,
    @Actor() persona: Persona,
    @ActorCtx() actor: ActorContext,
  ) {
    return this.queries.execute(new AskCopilotQuery(body.question, persona, actor));
  }

  @Get('conversations')
  getConversations(@ActorCtx() actor: ActorContext) {
    return this.queries.execute(new GetConversationsQuery(actor));
  }

  @Post('conversations')
  createConversation(@ActorCtx() actor: ActorContext) {
    return this.commands.execute(new CreateConversationCommand(actor));
  }

  @Delete('conversations/:id')
  deleteConversation(@Param('id') id: string, @ActorCtx() actor: ActorContext) {
    return this.commands.execute(new DeleteConversationCommand(id, actor));
  }

  @Post('conversations/:id/messages')
  sendChatMessage(
    @Param('id') id: string,
    @Body() body: SendChatMessageDto,
    @Actor() persona: Persona,
    @ActorCtx() actor: ActorContext,
  ) {
    return this.commands.execute(new SendChatMessageCommand(id, body.content, persona, actor));
  }

  /* -------------------- Custom Calculator Engine --------------------- */

  @Get('calc-rules')
  @Roles('HR_ADMIN')
  getCalcRules() {
    return this.queries.execute(new GetCalcRulesQuery());
  }

  @Post('calc-rules')
  @Roles('HR_ADMIN')
  createCalcRule(@Body() body: CalcRuleDto) {
    return this.commands.execute(new CreateCalcRuleCommand(body));
  }

  @Patch('calc-rules/:id')
  @Roles('HR_ADMIN')
  updateCalcRule(@Param('id') id: string, @Body() body: UpdateCalcRuleDto) {
    return this.commands.execute(new UpdateCalcRuleCommand(id, body));
  }

  @Delete('calc-rules/:id')
  @Roles('HR_ADMIN')
  deleteCalcRule(@Param('id') id: string) {
    return this.commands.execute(new DeleteCalcRuleCommand(id));
  }

  /* ---------------- Policy handbook (RAG knowledge base) ----------------- */

  @Get('policy-documents')
  @Roles('HR_ADMIN')
  getPolicyDocuments() {
    return this.queries.execute(new GetPolicyDocumentsQuery());
  }

  @Post('policy-documents')
  @Roles('HR_ADMIN')
  uploadPolicyDocument(@Body() body: UploadPolicyDocumentDto) {
    return this.commands.execute(new UploadPolicyDocumentCommand(body));
  }

  @Delete('policy-documents/:id')
  @Roles('HR_ADMIN')
  deletePolicyDocument(@Param('id') id: string) {
    return this.commands.execute(new DeletePolicyDocumentCommand(id));
  }

  @Post('policy-documents/:id/retry')
  @Roles('HR_ADMIN')
  retryPolicyIngestion(@Param('id') id: string) {
    return this.commands.execute(new RetryPolicyIngestionCommand(id));
  }
}
