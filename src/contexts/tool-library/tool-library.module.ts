// src/contexts/tool-library/tool-library.module.ts
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AiModule } from 'src/platform/ai/ai.module';
import { ToolLibraryController } from './interface/tool-library.controller';
import { ToolLibraryRepository } from './infrastructure/tool-library.repository';
import { ToolCatalogSyncService } from './infrastructure/tool-catalog-sync.service';
import { ListToolsHandler } from './application/queries/list-tools.query';
import { GetToolAccessHandler } from './application/queries/get-tool-access.query';
import { SetToolEnabledHandler } from './application/commands/set-tool-enabled.command';
import { SetToolGrantsHandler } from './application/commands/set-tool-grants.command';
import { RunToolHandler } from './application/commands/run-tool.command';

@Module({
  imports: [CqrsModule, AiModule],
  controllers: [ToolLibraryController],
  providers: [
    ToolLibraryRepository,
    ToolCatalogSyncService,
    ListToolsHandler,
    GetToolAccessHandler,
    SetToolEnabledHandler,
    SetToolGrantsHandler,
    RunToolHandler,
  ],
})
export class ToolLibraryModule {}
