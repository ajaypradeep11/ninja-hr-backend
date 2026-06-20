// src/contexts/people/interface/people.controller.ts
import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { QueryBus } from '@nestjs/cqrs';
import { GetEmployeesQuery } from '../application/queries/get-employees.query';
import { GetEmployeeByNameQuery } from '../application/queries/get-employee-by-name.query';
import { GetHeadcountQuery } from '../application/queries/get-headcount.query';
import { GetSalaryBenchmarksQuery } from '../application/queries/get-salary-benchmarks.query';

@ApiTags('people')
@Controller('people')
export class PeopleController {
  constructor(private readonly queries: QueryBus) {}

  @Get('employees')
  getEmployees() {
    return this.queries.execute(new GetEmployeesQuery());
  }

  @Get('employees/by-name/:name')
  getEmployeeByName(@Param('name') name: string) {
    return this.queries.execute(new GetEmployeeByNameQuery(name));
  }

  @Get('headcount')
  getHeadcount() {
    return this.queries.execute(new GetHeadcountQuery());
  }

  @Get('salary-benchmarks')
  getSalaryBenchmarks() {
    return this.queries.execute(new GetSalaryBenchmarksQuery());
  }
}
