// src/contexts/workplace/workplace.module.ts
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AiModule } from 'src/platform/ai/ai.module';
import { WorkplaceController } from './interface/workplace.controller';
import { WorkplaceRepository } from './infrastructure/workplace.repository';
import { GetVaultDocumentsHandler } from './application/queries/get-vault-documents.query';
import { GetTrainingCoursesHandler } from './application/queries/get-training-courses.query';
import {
  AssignTrainingHandler,
  CreateCourseHandler,
  DeleteCourseHandler,
  GetAllAssignmentsHandler,
  GetCourseAssignmentsHandler,
  GetMyTrainingHandler,
  UpdateAssignmentHandler,
  UpdateCourseHandler,
  GetMyCoursesHandler,
  CreatePeerCourseHandler,
  UpdatePeerCourseHandler,
  DeletePeerCourseHandler,
} from './application/training.handlers';
import {
  CreateLetterTemplateHandler,
  DeleteLetterTemplateHandler,
  GetLetterTemplatesHandler,
  IssueLetterHandler,
  DraftLetterHandler,
  CreateMassLetterRunHandler,
  UpdateLetterTemplateHandler,
} from './application/letters.handlers';
import { DeleteVaultDocumentHandler, GetVaultDocumentFileHandler, UploadVaultDocumentHandler } from './application/documents.handlers';
import { LetterDraftService } from './infrastructure/letter-draft.service';
import { MassLetterService } from './infrastructure/mass-letter.service';
import { MassLetterApprovalService } from './infrastructure/mass-letter-approval.service';

@Module({
  imports: [CqrsModule, AiModule],
  controllers: [WorkplaceController],
  providers: [
    WorkplaceRepository,
    GetVaultDocumentsHandler,
    UploadVaultDocumentHandler,
    DeleteVaultDocumentHandler,
    GetVaultDocumentFileHandler,
    GetTrainingCoursesHandler,
    CreateCourseHandler,
    UpdateCourseHandler,
    GetMyCoursesHandler,
    CreatePeerCourseHandler,
    UpdatePeerCourseHandler,
    DeletePeerCourseHandler,
    DeleteCourseHandler,
    AssignTrainingHandler,
    GetAllAssignmentsHandler,
    GetCourseAssignmentsHandler,
    GetMyTrainingHandler,
    UpdateAssignmentHandler,
    GetLetterTemplatesHandler,
    CreateLetterTemplateHandler,
    UpdateLetterTemplateHandler,
    DeleteLetterTemplateHandler,
    IssueLetterHandler,
    DraftLetterHandler,
    CreateMassLetterRunHandler,
    LetterDraftService,
    MassLetterService,
    MassLetterApprovalService,
  ],
  exports: [MassLetterApprovalService],
})
export class WorkplaceModule {}
