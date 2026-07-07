// src/contexts/offboarding/application/commands/set-offboarding-assignee.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OffboardingRepository } from '../../infrastructure/offboarding.repository';
import type { OffboardingOwner, OffboardingTask } from '../../domain/offboarding.types';

/** HR delegates a department's separation tasks to an internal owner. */
export class SetOffboardingAssigneeCommand {
  constructor(
    public readonly owner: OffboardingOwner,
    public readonly assignee: string | null,
  ) {}
}

@CommandHandler(SetOffboardingAssigneeCommand)
export class SetOffboardingAssigneeHandler
  implements ICommandHandler<SetOffboardingAssigneeCommand, OffboardingTask[]>
{
  constructor(private readonly repo: OffboardingRepository) {}

  execute({ owner, assignee }: SetOffboardingAssigneeCommand): Promise<OffboardingTask[]> {
    return this.repo.setDepartmentAssignee(owner, assignee);
  }
}
