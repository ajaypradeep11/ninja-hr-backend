// src/contexts/onboarding/application/commands/set-checklist.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';
import { settle } from '../onboarding.settle';
import type { ChecklistTask, OnboardingCase } from '../../domain/onboarding.types';

export class SetChecklistCommand {
  constructor(public readonly id: string, public readonly tasks: ChecklistTask[]) {}
}

@CommandHandler(SetChecklistCommand)
export class SetChecklistHandler implements ICommandHandler<SetChecklistCommand, OnboardingCase | null> {
  constructor(private readonly repo: OnboardingRepository) {}
  async execute({ id, tasks }: SetChecklistCommand): Promise<OnboardingCase | null> {
    await this.repo.replaceChecklist(id, tasks);
    await this.repo.addAudit(id, 'Onboarding checklist updated');
    return settle(this.repo, id);
  }
}
