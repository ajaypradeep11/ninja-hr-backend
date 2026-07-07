// src/contexts/timeoff/application/commands/update-leave.command.ts
// HR absence-record override: edit dates, type, duration (days or hours) or
// status directly from the company-wide log. HR-only at the route.
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TimeoffRepository, type UpdateLeaveInput } from '../../infrastructure/timeoff.repository';
import type { ActorContext } from 'src/platform/auth/actor-context';
import type { LeaveRequest } from '../../domain/timeoff.types';

export class UpdateLeaveCommand {
  constructor(
    public readonly id: string,
    public readonly input: UpdateLeaveInput,
    public readonly actor: ActorContext,
  ) {}
}

@CommandHandler(UpdateLeaveCommand)
export class UpdateLeaveHandler implements ICommandHandler<UpdateLeaveCommand, LeaveRequest[]> {
  constructor(private readonly repo: TimeoffRepository) {}

  async execute({ id, input, actor }: UpdateLeaveCommand): Promise<LeaveRequest[]> {
    // Tiered: HR edits anything; owners edit their own PENDING requests only.
    await this.repo.updateLeave(id, input, actor);
    return this.repo.getLeaveRequests(actor);
  }
}
