// src/contexts/onboarding/onboarding.module.ts
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { OnboardingController } from './interface/onboarding.controller';
import { OnboardingRepository } from './infrastructure/onboarding.repository';
import { ListCasesHandler } from './application/queries/list-cases.query';
import { GetPipelineHandler } from './application/queries/get-pipeline.query';
import { CreateCaseHandler } from './application/commands/create-case.command';
import { MarkFormHandler } from './application/commands/mark-form.command';
import { AddConsentHandler } from './application/commands/add-consent.command';
import { FinalizeSubmissionHandler } from './application/commands/finalize-submission.command';
import { SetChecklistHandler } from './application/commands/set-checklist.command';
import { SetTaskStatusHandler } from './application/commands/set-task-status.command';
import { VerifyDocumentHandler } from './application/commands/verify-document.command';
import { TogglePolicyHandler } from './application/commands/toggle-policy.command';
import { ActivateHandler } from './application/commands/activate.command';

@Module({
  imports: [CqrsModule],
  controllers: [OnboardingController],
  providers: [
    OnboardingRepository,
    ListCasesHandler, GetPipelineHandler,
    CreateCaseHandler, MarkFormHandler, AddConsentHandler, FinalizeSubmissionHandler,
    SetChecklistHandler, SetTaskStatusHandler, VerifyDocumentHandler, TogglePolicyHandler, ActivateHandler,
  ],
})
export class OnboardingModule {}
