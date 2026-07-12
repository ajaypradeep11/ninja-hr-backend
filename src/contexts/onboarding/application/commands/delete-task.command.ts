// src/contexts/onboarding/application/commands/delete-task.command.ts
import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';
import { settle } from '../onboarding.settle';
import type { OnboardingCase } from '../../domain/onboarding.types';

/**
 * Deletes ONE checklist task by id. Deliberately not a full-checklist replace:
 * replace (deleteMany + createMany) under two concurrent requests can
 * interleave and re-create tasks the other request just wrote, which is how
 * a double-clicked Delete used to multiply the checklist.
 */
export class DeleteTaskCommand {
  constructor(public readonly id: string, public readonly taskId: string) {}
}

@CommandHandler(DeleteTaskCommand)
export class DeleteTaskHandler implements ICommandHandler<DeleteTaskCommand, OnboardingCase | null> {
  constructor(private readonly repo: OnboardingRepository) {}
  async execute({ id, taskId }: DeleteTaskCommand): Promise<OnboardingCase | null> {
    const deleted = await this.repo.deleteTask(id, taskId);
    if (!deleted) throw new NotFoundException(`Task ${taskId} not found on case ${id}`);
    await this.repo.addAudit(id, `Checklist task ${taskId} deleted`);
    return settle(this.repo, id);
  }
}
