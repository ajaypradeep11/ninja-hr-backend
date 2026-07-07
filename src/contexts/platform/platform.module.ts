// src/contexts/platform/platform.module.ts
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PlatformController } from './interface/platform.controller';
import { PlatformRepository } from './infrastructure/platform.repository';
import { CopilotService } from './infrastructure/copilot.service';
import { GetSettingsHandler } from './application/queries/get-settings.query';
import { GetAgentRunsHandler } from './application/queries/get-agent-runs.query';
import { AskCopilotHandler } from './application/queries/ask-copilot.query';
import { SaveSettingsHandler } from './application/commands/save-settings.command';
import { CreateAgentRunHandler } from './application/commands/create-agent-run.command';
import { SetAgentRunStatusHandler } from './application/commands/set-agent-run-status.command';
import {
  CreateCalcRuleHandler,
  DeleteCalcRuleHandler,
  GetCalcRulesHandler,
  UpdateCalcRuleHandler,
} from './application/calc.handlers';

@Module({
  imports: [CqrsModule],
  controllers: [PlatformController],
  providers: [
    PlatformRepository,
    CopilotService,
    GetSettingsHandler,
    GetAgentRunsHandler,
    AskCopilotHandler,
    SaveSettingsHandler,
    CreateAgentRunHandler,
    SetAgentRunStatusHandler,
    GetCalcRulesHandler,
    CreateCalcRuleHandler,
    UpdateCalcRuleHandler,
    DeleteCalcRuleHandler,
  ],
})
export class PlatformModule {}
