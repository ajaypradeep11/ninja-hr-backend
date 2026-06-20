// src/contexts/recruitment/recruitment.module.ts
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { RecruitmentController } from './interface/recruitment.controller';
import { RecruitmentRepository } from './infrastructure/recruitment.repository';
import { GetRequisitionsHandler } from './application/queries/get-requisitions.query';
import { GetCandidatesHandler } from './application/queries/get-candidates.query';
import { PublishRequisitionHandler } from './application/commands/publish-requisition.command';
import { SetCandidateStageHandler } from './application/commands/set-candidate-stage.command';

@Module({
  imports: [CqrsModule],
  controllers: [RecruitmentController],
  providers: [
    RecruitmentRepository,
    GetRequisitionsHandler,
    GetCandidatesHandler,
    PublishRequisitionHandler,
    SetCandidateStageHandler,
  ],
})
export class RecruitmentModule {}
