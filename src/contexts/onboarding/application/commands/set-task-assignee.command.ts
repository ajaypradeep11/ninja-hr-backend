// src/contexts/onboarding/application/commands/set-task-assignee.command.ts
// Assign an internal employee to own a department's block of checklist tasks
// (e.g. a specific Finance admin owns the Finance tasks for this case).
import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';
import type { OnboardingCase, TaskOwner } from '../../domain/onboarding.types';

export class SetTaskAssigneeCommand {
  constructor(
    public readonly caseId: string,
    public readonly owner: TaskOwner,
    public readonly employeeName: string | null,
  ) {}
}

@CommandHandler(SetTaskAssigneeCommand)
export class SetTaskAssigneeHandler
  implements ICommandHandler<SetTaskAssigneeCommand, OnboardingCase | null>
{
  constructor(private readonly repo: OnboardingRepository) {}

  async execute({ caseId, owner, employeeName }: SetTaskAssigneeCommand): Promise<OnboardingCase | null> {
    await this.repo.setTaskAssignee(caseId, owner, employeeName);
    await this.repo.addAudit(
      caseId,
      employeeName ? `${owner} tasks assigned to ${employeeName}` : `${owner} tasks unassigned`,
    );
    const c = await this.repo.findById(caseId);
    if (!c) throw new NotFoundException('Onboarding case not found');
    return c;
  }
}
