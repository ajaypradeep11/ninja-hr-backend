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

@Module({
  imports: [CqrsModule],
  controllers: [WorkplaceController],
  providers: [
    WorkplaceRepository,
    GetVaultDocumentsHandler,
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
  ],
})
export class WorkplaceModule {}
