// src/contexts/onboarding/application/commands/mark-form.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';
import { settle } from '../onboarding.settle';
import type { FormFlags, OnboardingCase } from '../../domain/onboarding.types';

export class MarkFormCommand {
  constructor(public readonly token: string, public readonly key: keyof FormFlags) {}
}

@CommandHandler(MarkFormCommand)
export class MarkFormHandler implements ICommandHandler<MarkFormCommand, OnboardingCase | null> {
  constructor(private readonly repo: OnboardingRepository) {}
  async execute({ token, key }: MarkFormCommand): Promise<OnboardingCase | null> {
    const c = await this.repo.findByToken(token);
    if (!c) return null;
    await this.repo.updateForms(token, { ...c.forms, [key]: true });
    return settle(this.repo, c.id);
  }
}
