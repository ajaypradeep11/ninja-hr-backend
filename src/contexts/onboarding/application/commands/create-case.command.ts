// src/contexts/onboarding/application/commands/create-case.command.ts
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
    const stamp = Date.now();
    const dept = input.department || 'Operations';
    const checklist = generateChecklist(dept, input.province);
    return this.repo.createCase({
      token: `inv_${stamp.toString(36)}`,
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
