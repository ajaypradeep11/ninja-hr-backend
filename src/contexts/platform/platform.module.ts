// src/contexts/platform/platform.module.ts
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AiModule } from 'src/platform/ai/ai.module';
import { WorkplaceModule } from '../workplace/workplace.module';
import { PlatformController } from './interface/platform.controller';
import { PlatformRepository } from './infrastructure/platform.repository';
import { CopilotService } from './infrastructure/copilot.service';
import { GetSettingsHandler } from './application/queries/get-settings.query';
import { GetAgentRunsHandler } from './application/queries/get-agent-runs.query';
import { GetModerationEventsHandler } from './application/queries/get-moderation-events.query';
import { AskCopilotHandler } from './application/queries/ask-copilot.query';
import { SaveSettingsHandler } from './application/commands/save-settings.command';
import { CreateAgentRunHandler } from './application/commands/create-agent-run.command';
import { SetAgentRunStatusHandler } from './application/commands/set-agent-run-status.command';
import { UploadPolicyDocumentHandler } from './application/commands/upload-policy-document.command';
import { DeletePolicyDocumentHandler } from './application/commands/delete-policy-document.command';
import { RetryPolicyIngestionHandler } from './application/commands/retry-policy-ingestion.command';
import { GetPolicyDocumentsHandler } from './application/queries/get-policy-documents.query';
import { PolicyRepository } from './infrastructure/policy.repository';
import { PolicyIngestionService } from './infrastructure/policy-ingestion.service';
import { PolicyRetrievalService } from './infrastructure/policy-retrieval.service';
import { SnapshotService } from './infrastructure/snapshot.service';
import { ConversationRepository } from './infrastructure/conversation.repository';
import { ChatAgentService } from './infrastructure/chat-agent.service';
import { GetConversationsHandler } from './application/queries/get-conversations.query';
import { CreateConversationHandler } from './application/commands/create-conversation.command';
import { DeleteConversationHandler } from './application/commands/delete-conversation.command';
import { SendChatMessageHandler } from './application/commands/send-chat-message.command';
import {
  CreateCalcRuleHandler,
  DeleteCalcRuleHandler,
  GetCalcRulesHandler,
  UpdateCalcRuleHandler,
} from './application/calc.handlers';

@Module({
  imports: [CqrsModule, AiModule, WorkplaceModule],
  controllers: [PlatformController],
  providers: [
    PlatformRepository,
    CopilotService,
    GetSettingsHandler,
    GetAgentRunsHandler,
    GetModerationEventsHandler,
    AskCopilotHandler,
    SaveSettingsHandler,
    CreateAgentRunHandler,
    SetAgentRunStatusHandler,
    PolicyRepository,
    PolicyIngestionService,
    PolicyRetrievalService,
    SnapshotService,
    ConversationRepository,
    ChatAgentService,
    GetConversationsHandler,
    CreateConversationHandler,
    DeleteConversationHandler,
    SendChatMessageHandler,
    GetPolicyDocumentsHandler,
    UploadPolicyDocumentHandler,
    DeletePolicyDocumentHandler,
    RetryPolicyIngestionHandler,
    GetCalcRulesHandler,
    CreateCalcRuleHandler,
    UpdateCalcRuleHandler,
    DeleteCalcRuleHandler,
  ],
  exports: [PolicyRetrievalService],
})
export class PlatformModule {}
