import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PeopleRepository } from '../../infrastructure/people.repository';
import type { Employee } from '../../domain/people.types';

export class GetEmployeesQuery {}

@QueryHandler(GetEmployeesQuery)
export class GetEmployeesHandler implements IQueryHandler<GetEmployeesQuery, Employee[]> {
  constructor(private readonly repo: PeopleRepository) {}
  execute(): Promise<Employee[]> {
    return this.repo.getEmployees();
  }
}
