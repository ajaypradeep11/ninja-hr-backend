// src/contexts/workplace/workplace.module.ts
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { WorkplaceController } from './interface/workplace.controller';
import { WorkplaceRepository } from './infrastructure/workplace.repository';
import { GetBenefitsCarriersHandler } from './application/queries/get-benefits-carriers.query';
import { GetVaultDocumentsHandler } from './application/queries/get-vault-documents.query';
import { GetTrainingCoursesHandler } from './application/queries/get-training-courses.query';

@Module({
  imports: [CqrsModule],
  controllers: [WorkplaceController],
  providers: [
    WorkplaceRepository,
    GetBenefitsCarriersHandler,
    GetVaultDocumentsHandler,
    GetTrainingCoursesHandler,
  ],
})
export class WorkplaceModule {}
