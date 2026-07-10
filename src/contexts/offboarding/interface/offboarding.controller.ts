// src/contexts/offboarding/interface/offboarding.controller.ts
import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Roles } from 'src/platform/auth/roles.decorator';
import { GetOffboardingTasksQuery } from '../application/queries/get-offboarding-tasks.query';
import { SetOffboardingTaskStatusCommand } from '../application/commands/set-offboarding-task-status.command';
import { SetOffboardingAssigneeCommand } from '../application/commands/set-offboarding-assignee.command';
import { FinalizeTerminationCommand } from '../application/commands/finalize-termination.command';
import {
  SetTaskStatusDto,
  SetOffboardingAssigneeDto,
  FinalizeTerminationDto,
} from './dto/offboarding.dto';

@ApiTags('offboarding')
@Controller('offboarding')
// Entire offboarding surface (viewing who is being separated, mutating tasks,
// and finalizing terminations) is HR-only. Without this any authenticated
// employee could terminate a colleague or read the separation board.
@Roles('HR_ADMIN')
export class OffboardingController {
  constructor(
    private readonly queries: QueryBus,
    private readonly commands: CommandBus,
  ) {}

  @Get('tasks')
  getTasks() {
    return this.queries.execute(new GetOffboardingTasksQuery());
  }

  @Patch('tasks/:id/status')
  setTaskStatus(@Param('id') id: string, @Body() body: SetTaskStatusDto) {
    return this.commands.execute(new SetOffboardingTaskStatusCommand(id, body.status));
  }

  /** Delegate a department's separation tasks to an internal owner. */
  @Patch('assignees')
  setAssignee(@Body() body: SetOffboardingAssigneeDto) {
    return this.commands.execute(
      new SetOffboardingAssigneeCommand(body.owner, body.assignee ?? null),
    );
  }

  @Post('terminate')
  @HttpCode(200)
  finalizeTermination(@Body() body: FinalizeTerminationDto) {
    return this.commands.execute(new FinalizeTerminationCommand(body.employeeName, body.override ?? false));
  }
}
