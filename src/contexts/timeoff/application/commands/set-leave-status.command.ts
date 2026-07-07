// src/contexts/timeoff/application/commands/set-leave-status.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TimeoffRepository } from '../../infrastructure/timeoff.repository';
import type { ActorContext } from 'src/platform/auth/actor-context';
import type { LeaveRequest, LeaveStatus } from '../../domain/timeoff.types';

export class SetLeaveStatusCommand {
  constructor(
    public readonly id: string,
    public readonly status: LeaveStatus,
    public readonly actor: ActorContext,
  ) {}
}

@CommandHandler(SetLeaveStatusCommand)
export class SetLeaveStatusHandler
  implements ICommandHandler<SetLeaveStatusCommand, LeaveRequest[]>
{
  constructor(private readonly repo: TimeoffRepository) {}

  async execute({ id, status, actor }: SetLeaveStatusCommand): Promise<LeaveRequest[]> {
    // Repo enforces routing: only the department's manager (or HR override).
    await this.repo.updateStatus(id, status, actor);
    return this.repo.getLeaveRequests(actor);
  }
}
