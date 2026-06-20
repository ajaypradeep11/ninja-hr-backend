// src/contexts/workplace/interface/workplace.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { QueryBus } from '@nestjs/cqrs';
import { GetBenefitsCarriersQuery } from '../application/queries/get-benefits-carriers.query';
import { GetVaultDocumentsQuery } from '../application/queries/get-vault-documents.query';
import { GetTrainingCoursesQuery } from '../application/queries/get-training-courses.query';

@ApiTags('workplace')
@Controller('workplace')
export class WorkplaceController {
  constructor(private readonly queries: QueryBus) {}

  @Get('benefits-carriers')
  getBenefitsCarriers() {
    return this.queries.execute(new GetBenefitsCarriersQuery());
  }

  @Get('documents')
  getVaultDocuments() {
    return this.queries.execute(new GetVaultDocumentsQuery());
  }

  @Get('training-courses')
  getTrainingCourses() {
    return this.queries.execute(new GetTrainingCoursesQuery());
  }
}
