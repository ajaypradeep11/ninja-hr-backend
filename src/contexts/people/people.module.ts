// src/contexts/people/people.module.ts
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PeopleController } from './interface/people.controller';
import { PeopleRepository } from './infrastructure/people.repository';
import { GetEmployeesHandler } from './application/queries/get-employees.query';
import { GetEmployeeByNameHandler } from './application/queries/get-employee-by-name.query';
import { GetEmployeeDetailHandler } from './application/queries/get-employee-detail.query';
import { GetHeadcountHandler } from './application/queries/get-headcount.query';
import { GetSalaryBenchmarksHandler } from './application/queries/get-salary-benchmarks.query';
import { UpdateEmployeeHandler } from './application/commands/update-employee.command';
import {
  AddEmergencyContactHandler,
  DeleteEmergencyContactHandler,
} from './application/commands/emergency-contact.commands';

@Module({
  imports: [CqrsModule],
  controllers: [PeopleController],
  providers: [
    PeopleRepository,
    GetEmployeesHandler,
    GetEmployeeByNameHandler,
    GetEmployeeDetailHandler,
    GetHeadcountHandler,
    GetSalaryBenchmarksHandler,
    UpdateEmployeeHandler,
    AddEmergencyContactHandler,
    DeleteEmergencyContactHandler,
  ],
})
export class PeopleModule {}
