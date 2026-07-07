// src/contexts/timeoff/interface/timeoff.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ActorCtx, type ActorContext } from 'src/platform/auth/actor-context';
import { GetLeaveRequestsQuery } from '../application/queries/get-leave-requests.query';
import { SetLeaveStatusCommand } from '../application/commands/set-leave-status.command';
import { CreateLeaveRequestCommand } from '../application/commands/create-leave-request.command';
import { UpdateLeaveCommand } from '../application/commands/update-leave.command';
import { CancelLeaveCommand } from '../application/commands/cancel-leave.command';
import { SetLeaveStatusDto, CreateLeaveRequestDto, UpdateLeaveDto } from './dto/timeoff.dto';

@ApiTags('timeoff')
@Controller('timeoff')
export class TimeoffController {
  constructor(
    private readonly queries: QueryBus,
    private readonly commands: CommandBus,
  ) {}

  /** Actor-scoped: HR = company-wide log, manager = own department, employee = own. */
  @Get('leave-requests')
  getLeaveRequests(@ActorCtx() actor: ActorContext) {
    return this.queries.execute(new GetLeaveRequestsQuery(actor));
  }

  /**
   * Approve/deny — routed to the employee's DEPARTMENT MANAGER (HR retains an
   * override, but the queue lives with the manager, not the HR console).
   */
  @Patch('leave-requests/:id/status')
  setLeaveStatus(
    @Param('id') id: string,
    @Body() body: SetLeaveStatusDto,
    @ActorCtx() actor: ActorContext,
  ) {
    return this.commands.execute(new SetLeaveStatusCommand(id, body.status, actor));
  }

  /**
   * Edit a record. Tiered in the repo: HR overrides anything (incl. status);
   * an employee may edit their OWN request while it's still Pending.
   */
  @Patch('leave-requests/:id')
  updateLeave(
    @Param('id') id: string,
    @Body() body: UpdateLeaveDto,
    @ActorCtx() actor: ActorContext,
  ) {
    return this.commands.execute(new UpdateLeaveCommand(id, body, actor));
  }

  /** Cancel/withdraw: owner while Pending, or HR any time. */
  @Delete('leave-requests/:id')
  cancelLeave(@Param('id') id: string, @ActorCtx() actor: ActorContext) {
    return this.commands.execute(new CancelLeaveCommand(id, actor));
  }

  @Post('leave-requests')
  createLeaveRequest(@Body() body: CreateLeaveRequestDto, @ActorCtx() actor: ActorContext) {
    return this.commands.execute(
      new CreateLeaveRequestCommand(
        {
          employeeName: body.employeeName,
          type: body.type,
          start: body.start,
          end: body.end,
          days: body.days,
          hours: body.hours,
        },
        actor,
      ),
    );
  }
}
