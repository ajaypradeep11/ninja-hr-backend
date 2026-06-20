// src/contexts/timeoff/interface/timeoff.controller.ts
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { GetLeaveRequestsQuery } from '../application/queries/get-leave-requests.query';
import { SetLeaveStatusCommand } from '../application/commands/set-leave-status.command';
import { CreateLeaveRequestCommand } from '../application/commands/create-leave-request.command';
import { SetLeaveStatusDto, CreateLeaveRequestDto } from './dto/timeoff.dto';

@ApiTags('timeoff')
@Controller('timeoff')
export class TimeoffController {
  constructor(
    private readonly queries: QueryBus,
    private readonly commands: CommandBus,
  ) {}

  @Get('leave-requests')
  getLeaveRequests() {
    return this.queries.execute(new GetLeaveRequestsQuery());
  }

  @Patch('leave-requests/:id/status')
  setLeaveStatus(@Param('id') id: string, @Body() body: SetLeaveStatusDto) {
    return this.commands.execute(new SetLeaveStatusCommand(id, body.status));
  }

  @Post('leave-requests')
  createLeaveRequest(@Body() body: CreateLeaveRequestDto) {
    return this.commands.execute(
      new CreateLeaveRequestCommand({
        employeeName: body.employeeName,
        type: body.type,
        start: body.start,
        end: body.end,
        days: body.days,
      }),
    );
  }
}
