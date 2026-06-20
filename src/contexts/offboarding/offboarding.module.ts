// src/contexts/offboarding/offboarding.module.ts
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { OffboardingController } from './interface/offboarding.controller';
import { OffboardingRepository } from './infrastructure/offboarding.repository';
import { GetOffboardingTasksHandler } from './application/queries/get-offboarding-tasks.query';
import { SetOffboardingTaskStatusHandler } from './application/commands/set-offboarding-task-status.command';
import { FinalizeTerminationHandler } from './application/commands/finalize-termination.command';

@Module({
  imports: [CqrsModule],
  controllers: [OffboardingController],
  providers: [
    OffboardingRepository,
    GetOffboardingTasksHandler,
    SetOffboardingTaskStatusHandler,
    FinalizeTerminationHandler,
  ],
})
export class OffboardingModule {}
