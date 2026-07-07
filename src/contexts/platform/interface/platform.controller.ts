// src/contexts/platform/interface/platform.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { GetSettingsQuery } from '../application/queries/get-settings.query';
import { GetAgentRunsQuery } from '../application/queries/get-agent-runs.query';
import { AskCopilotQuery } from '../application/queries/ask-copilot.query';
import { SaveSettingsCommand } from '../application/commands/save-settings.command';
import { CreateAgentRunCommand } from '../application/commands/create-agent-run.command';
import { SetAgentRunStatusCommand } from '../application/commands/set-agent-run-status.command';
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
} from './dto/platform.dto';
import { Actor } from 'src/platform/auth/actor.decorator';
import type { Persona } from 'src/platform/auth/actor.decorator';
import { Roles } from 'src/platform/auth/roles.decorator';

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
  saveSettings(@Body() body: SaveSettingsDto) {
    return this.commands.execute(new SaveSettingsCommand(body));
  }

  @Get('agent-runs')
  getAgentRuns() {
    return this.queries.execute(new GetAgentRunsQuery());
  }

  @Post('agent-runs')
  createAgentRun(@Body() body: CreateAgentRunDto) {
    return this.commands.execute(new CreateAgentRunCommand(body.intent));
  }

  @Patch('agent-runs/:id/status')
  setAgentRunStatus(@Param('id') id: string, @Body() body: SetAgentRunStatusDto) {
    return this.commands.execute(new SetAgentRunStatusCommand(id, body.status));
  }

  @Post('copilot/ask')
  askCopilot(@Body() body: AskCopilotDto, @Actor() persona: Persona) {
    return this.queries.execute(new AskCopilotQuery(body.question, persona));
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
}
