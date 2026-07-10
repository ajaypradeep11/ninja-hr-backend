// src/contexts/timeoff/application/commands/create-leave-request.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TimeoffRepository, type CreateLeaveInput } from '../../infrastructure/timeoff.repository';
import type { ActorContext } from 'src/platform/auth/actor-context';
import type { LeaveRequest } from '../../domain/timeoff.types';

export class CreateLeaveRequestCommand {
  constructor(public readonly input: CreateLeaveInput, public readonly actor?: ActorContext) {}
}

@CommandHandler(CreateLeaveRequestCommand)
export class CreateLeaveRequestHandler
  implements ICommandHandler<CreateLeaveRequestCommand, LeaveRequest[]>
{
  constructor(private readonly repo: TimeoffRepository) {}

  async execute({ input, actor }: CreateLeaveRequestCommand): Promise<LeaveRequest[]> {
    // A non-HR actor may only file leave for THEMSELVES. Without this an
    // employee could fabricate leave/overtime against a colleague by passing
    // that colleague's name. HR (and the trusted persona fallback, which has no
    // resolved employee) may file on anyone's behalf.
    const scoped =
      actor && actor.role !== 'HR_ADMIN' && actor.employeeName
        ? { ...input, employeeName: actor.employeeName }
        : input;
    await this.repo.createLeave(scoped);
    return this.repo.getLeaveRequests(actor);
  }
}
