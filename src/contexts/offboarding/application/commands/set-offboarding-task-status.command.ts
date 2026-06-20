// src/contexts/offboarding/application/commands/set-offboarding-task-status.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OffboardingRepository } from '../../infrastructure/offboarding.repository';
import type { OffboardingStatus, OffboardingTask } from '../../domain/offboarding.types';

export class SetOffboardingTaskStatusCommand {
  constructor(
    public readonly id: string,
    public readonly status: OffboardingStatus,
  ) {}
}

@CommandHandler(SetOffboardingTaskStatusCommand)
export class SetOffboardingTaskStatusHandler
  implements ICommandHandler<SetOffboardingTaskStatusCommand, OffboardingTask[]>
{
  constructor(private readonly repo: OffboardingRepository) {}

  execute({ id, status }: SetOffboardingTaskStatusCommand): Promise<OffboardingTask[]> {
    return this.repo.setTaskStatus(id, status);
  }
}
