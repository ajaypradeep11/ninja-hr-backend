// src/contexts/timeoff/timeoff.module.ts
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TimeoffController } from './interface/timeoff.controller';
import { TimeoffRepository } from './infrastructure/timeoff.repository';
import { GetLeaveRequestsHandler } from './application/queries/get-leave-requests.query';
import { SetLeaveStatusHandler } from './application/commands/set-leave-status.command';
import { CreateLeaveRequestHandler } from './application/commands/create-leave-request.command';
import { UpdateLeaveHandler } from './application/commands/update-leave.command';
import { CancelLeaveHandler } from './application/commands/cancel-leave.command';

@Module({
  imports: [CqrsModule],
  controllers: [TimeoffController],
  providers: [
    TimeoffRepository,
    GetLeaveRequestsHandler,
    SetLeaveStatusHandler,
    CreateLeaveRequestHandler,
    UpdateLeaveHandler,
    CancelLeaveHandler,
  ],
})
export class TimeoffModule {}
