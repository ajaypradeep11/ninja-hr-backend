// src/contexts/onboarding/application/commands/create-case.command.ts
import { randomBytes } from 'node:crypto';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { OnboardingRepository } from '../../infrastructure/onboarding.repository';
import { generateChecklist } from '../../domain/checklist.service';
import { FirebaseAdminService } from 'src/platform/auth/firebase-admin.service';
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
  private readonly logger = new Logger(CreateCaseHandler.name);

  constructor(
    private readonly repo: OnboardingRepository,
    private readonly firebase: FirebaseAdminService,
  ) {}
  async execute({ input }: CreateCaseCommand): Promise<OnboardingCase> {
    const dept = input.department || 'Operations';
    const checklist = generateChecklist(dept, input.province);
    const created = await this.repo.createCase({
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

    // NewCaseDto has no work-email field at preboard time — the only address
    // on file is personalEmail, so that's what gets a Firebase identity.
    // Non-fatal: a hiccup here must never block case creation.
    await this.firebase.provisionUser(input.personalEmail).catch((e: Error) => {
      this.logger.warn(`firebase provisioning failed for ${input.personalEmail}: ${e.message}`);
      return null;
    });

    return created;
  }
}
