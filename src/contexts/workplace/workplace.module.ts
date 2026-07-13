// src/contexts/workplace/workplace.module.ts
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
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
  UpdateLetterTemplateHandler,
} from './application/letters.handlers';
import { DeleteVaultDocumentHandler, UploadVaultDocumentHandler } from './application/documents.handlers';

@Module({
  imports: [CqrsModule],
  controllers: [WorkplaceController],
  providers: [
    WorkplaceRepository,
    GetVaultDocumentsHandler,
    UploadVaultDocumentHandler,
    DeleteVaultDocumentHandler,
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
  ],
})
export class WorkplaceModule {}
