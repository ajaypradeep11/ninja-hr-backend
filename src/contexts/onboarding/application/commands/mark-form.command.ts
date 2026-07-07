// src/contexts/onboarding/application/commands/mark-form.command.ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';
import { settle } from '../onboarding.settle';
import { FORM_KEYS, type FormFlags, type OnboardingCase } from '../../domain/onboarding.types';

export class MarkFormCommand {
  constructor(public readonly token: string, public readonly key: keyof FormFlags) {}
}

@CommandHandler(MarkFormCommand)
export class MarkFormHandler implements ICommandHandler<MarkFormCommand, OnboardingCase | null> {
  constructor(private readonly repo: OnboardingRepository) {}
  async execute({ token, key }: MarkFormCommand): Promise<OnboardingCase | null> {
    if (!FORM_KEYS.includes(key)) {
      throw new BadRequestException(`Unknown form key '${String(key)}' — expected one of: ${FORM_KEYS.join(', ')}`);
    }
    const c = await this.repo.findByToken(token);
    if (!c) throw new NotFoundException('Onboarding case not found for token');
    await this.repo.updateForms(token, { ...c.forms, [key]: true });
    return settle(this.repo, c.id);
  }
}
