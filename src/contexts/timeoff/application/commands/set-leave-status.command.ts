// src/contexts/timeoff/application/commands/set-leave-status.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TimeoffRepository } from '../../infrastructure/timeoff.repository';
import type { LeaveRequest, LeaveStatus } from '../../domain/timeoff.types';

export class SetLeaveStatusCommand {
  constructor(
    public readonly id: string,
    public readonly status: LeaveStatus,
  ) {}
}

@CommandHandler(SetLeaveStatusCommand)
export class SetLeaveStatusHandler
  implements ICommandHandler<SetLeaveStatusCommand, LeaveRequest[]>
{
  constructor(private readonly repo: TimeoffRepository) {}

  async execute({ id, status }: SetLeaveStatusCommand): Promise<LeaveRequest[]> {
    await this.repo.updateStatus(id, status);
    return this.repo.getLeaveRequests();
  }
}
