// src/contexts/recruitment/recruitment.module.ts
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { RecruitmentController } from './interface/recruitment.controller';
import { RecruitmentRepository } from './infrastructure/recruitment.repository';
import { ResumeParserService } from './infrastructure/resume-parser.service';
import { JdGeneratorService } from './infrastructure/jd-generator.service';
import { GenerateJdHandler } from './application/commands/generate-jd.command';
import { GetResumeFileHandler } from './application/queries/get-resume-file.query';
import { GetAssignedCandidatesHandler } from './application/queries/get-assigned-candidates.query';
import { AddNoteHandler } from './application/commands/add-note.command';
import { DraftMessageHandler } from './application/commands/draft-message.command';
import { RecordInboundHandler } from './application/commands/record-inbound.command';
import { MessageDrafterService } from './infrastructure/message-drafter.service';
import { GuideImporterService } from './infrastructure/guide-importer.service';
import {
  GetGuideTemplateHandler,
  ImportGuideHandler,
  SetGuideTemplateHandler,
} from './application/commands/guide-template.commands';
import { GetRequisitionsHandler } from './application/queries/get-requisitions.query';
import { GetRequisitionDetailHandler } from './application/queries/get-requisition-detail.query';
import { GetRequisitionCandidatesHandler } from './application/queries/get-requisition-candidates.query';
import { GetCandidatesHandler } from './application/queries/get-candidates.query';
import { GetJobsHandler } from './application/queries/get-jobs.query';
import { GetJobBySlugHandler } from './application/queries/get-job-by-slug.query';
import { GetPortalViewHandler } from './application/queries/get-portal-view.query';
import { ApplyToJobHandler } from './application/commands/apply-to-job.command';
import { WithdrawApplicationHandler } from './application/commands/withdraw-application.command';
import { GetCandidateDetailHandler } from './application/queries/get-candidate-detail.query';
import { GetTemplatesHandler } from './application/queries/get-templates.query';
import { SendCommunicationHandler } from './application/commands/send-communication.command';
import {
  CreateTemplateHandler,
  DeleteTemplateHandler,
  UpdateTemplateHandler,
} from './application/commands/template-crud.commands';
import { SetScorecardCriteriaHandler } from './application/commands/set-scorecard-criteria.command';
import { SubmitScorecardHandler } from './application/commands/submit-scorecard.command';
import { GetAnalyticsHandler } from './application/queries/get-analytics.query';
import { PurgeCandidateHandler } from './application/commands/purge-candidate.command';
import { SetCostHandler } from './application/commands/set-cost.command';
import { CreateRequisitionHandler } from './application/commands/create-requisition.command';
import { UpdateRequisitionHandler } from './application/commands/update-requisition.command';
import { SubmitRequisitionHandler } from './application/commands/submit-requisition.command';
import { DecideRequisitionHandler } from './application/commands/decide-requisition.command';
import { UpdatePublishingHandler } from './application/commands/update-publishing.command';
import { PublishRequisitionHandler } from './application/commands/publish-requisition.command';
import { SetCandidateStageHandler } from './application/commands/set-candidate-stage.command';
import { ArchiveRequisitionHandler } from './application/commands/archive-requisition.command';
import { DeleteRequisitionHandler } from './application/commands/delete-requisition.command';

@Module({
  imports: [CqrsModule],
  controllers: [RecruitmentController],
  providers: [
    RecruitmentRepository,
    ResumeParserService,
    JdGeneratorService,
    GenerateJdHandler,
    GetResumeFileHandler,
    GetAssignedCandidatesHandler,
    AddNoteHandler,
    MessageDrafterService,
    DraftMessageHandler,
    RecordInboundHandler,
    GuideImporterService,
    GetGuideTemplateHandler,
    SetGuideTemplateHandler,
    ImportGuideHandler,
    GetRequisitionsHandler,
    GetRequisitionDetailHandler,
    GetRequisitionCandidatesHandler,
    GetCandidatesHandler,
    CreateRequisitionHandler,
    ArchiveRequisitionHandler,
    DeleteRequisitionHandler,
    UpdateRequisitionHandler,
    SubmitRequisitionHandler,
    DecideRequisitionHandler,
    UpdatePublishingHandler,
    PublishRequisitionHandler,
    SetCandidateStageHandler,
    GetJobsHandler,
    GetJobBySlugHandler,
    GetPortalViewHandler,
    ApplyToJobHandler,
    WithdrawApplicationHandler,
    GetCandidateDetailHandler,
    GetTemplatesHandler,
    SendCommunicationHandler,
    CreateTemplateHandler,
    UpdateTemplateHandler,
    DeleteTemplateHandler,
    SetScorecardCriteriaHandler,
    SubmitScorecardHandler,
    GetAnalyticsHandler,
    PurgeCandidateHandler,
    SetCostHandler,
  ],
})
export class RecruitmentModule {}
