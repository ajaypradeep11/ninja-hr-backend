// src/contexts/onboarding/application/commands/set-task-status.command.ts
import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';
import { settle } from '../onboarding.settle';
import type { TaskStatus, OnboardingCase } from '../../domain/onboarding.types';

export class SetTaskStatusCommand {
  constructor(public readonly id: string, public readonly taskId: string, public readonly status: TaskStatus) {}
}

@CommandHandler(SetTaskStatusCommand)
export class SetTaskStatusHandler implements ICommandHandler<SetTaskStatusCommand, OnboardingCase | null> {
  constructor(private readonly repo: OnboardingRepository) {}
  async execute({ id, taskId, status }: SetTaskStatusCommand): Promise<OnboardingCase | null> {
    const updated = await this.repo.setTaskStatus(id, taskId, status);
    if (!updated) throw new NotFoundException(`Task ${taskId} not found on case ${id}`);
    return settle(this.repo, id);
  }
}
