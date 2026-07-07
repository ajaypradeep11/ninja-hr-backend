// src/contexts/timeoff/application/commands/cancel-leave.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TimeoffRepository } from '../../infrastructure/timeoff.repository';
import type { ActorContext } from 'src/platform/auth/actor-context';
import type { LeaveRequest } from '../../domain/timeoff.types';

export class CancelLeaveCommand {
  constructor(public readonly id: string, public readonly actor: ActorContext) {}
}

@CommandHandler(CancelLeaveCommand)
export class CancelLeaveHandler implements ICommandHandler<CancelLeaveCommand, LeaveRequest[]> {
  constructor(private readonly repo: TimeoffRepository) {}

  async execute({ id, actor }: CancelLeaveCommand): Promise<LeaveRequest[]> {
    await this.repo.cancelLeave(id, actor);
    return this.repo.getLeaveRequests(actor);
  }
}
