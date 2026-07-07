// src/contexts/onboarding/application/commands/create-case.command.ts
import { randomBytes } from 'node:crypto';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';
import { generateChecklist } from '../../domain/checklist.service';
import type { ProvinceCode } from 'src/shared-kernel/province';
import type { OnboardingCase } from '../../domain/onboarding.types';

export class CreateCaseCommand {
  constructor(
    public readonly input: {
      name: string; title?: string; department?: string;
      province: ProvinceCode; startDate: string; personalEmail: string;
    },
  ) {}
}

@CommandHandler(CreateCaseCommand)
export class CreateCaseHandler implements ICommandHandler<CreateCaseCommand, OnboardingCase> {
  constructor(private readonly repo: OnboardingRepository) {}
  execute({ input }: CreateCaseCommand): Promise<OnboardingCase> {
    const dept = input.department || 'Operations';
    const checklist = generateChecklist(dept, input.province);
    return this.repo.createCase({
      // The token is the sole credential for the employee-facing by-token
      // endpoints — it must be unguessable (a timestamp is enumerable).
      token: `inv_${randomBytes(18).toString('base64url')}`,
      name: input.name,
      title: input.title || 'New Hire',
      department: dept,
      province: input.province,
      startDate: new Date(input.startDate),
      personalEmail: input.personalEmail,
      checklist,
      audit: [
        `Profile created; invite emailed to ${input.personalEmail}`,
        'Agent generated department onboarding checklist',
      ],
    });
  }
}
