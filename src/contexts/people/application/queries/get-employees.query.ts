import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PeopleRepository } from '../../infrastructure/people.repository';
import type { Employee } from '../../domain/people.types';

export class GetEmployeesQuery {
  /** viewerIsHr: HR admins always see full DOBs (payroll/compliance). */
  constructor(public readonly viewerIsHr: boolean = false) {}
}

@QueryHandler(GetEmployeesQuery)
export class GetEmployeesHandler implements IQueryHandler<GetEmployeesQuery, Employee[]> {
  constructor(private readonly repo: PeopleRepository) {}
  execute(query: GetEmployeesQuery): Promise<Employee[]> {
    return this.repo.getEmployees(query.viewerIsHr);
  }
}
