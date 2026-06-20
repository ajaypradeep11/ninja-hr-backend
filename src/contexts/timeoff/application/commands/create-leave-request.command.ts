// src/contexts/timeoff/application/commands/create-leave-request.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TimeoffRepository, type CreateLeaveInput } from '../../infrastructure/timeoff.repository';
import type { LeaveRequest } from '../../domain/timeoff.types';

export class CreateLeaveRequestCommand {
  constructor(public readonly input: CreateLeaveInput) {}
}

@CommandHandler(CreateLeaveRequestCommand)
export class CreateLeaveRequestHandler
  implements ICommandHandler<CreateLeaveRequestCommand, LeaveRequest[]>
{
  constructor(private readonly repo: TimeoffRepository) {}

  async execute({ input }: CreateLeaveRequestCommand): Promise<LeaveRequest[]> {
    await this.repo.createLeave(input);
    return this.repo.getLeaveRequests();
  }
}
