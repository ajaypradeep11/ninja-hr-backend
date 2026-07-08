import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PeopleRepository } from '../../infrastructure/people.repository';
import type { Employee } from '../../domain/people.types';

export class GetEmployeeByNameQuery {
  constructor(
    public readonly name: string,
    public readonly viewerIsHr: boolean = false,
  ) {}
}

@QueryHandler(GetEmployeeByNameQuery)
export class GetEmployeeByNameHandler
  implements IQueryHandler<GetEmployeeByNameQuery, Employee | null>
{
  constructor(private readonly repo: PeopleRepository) {}
  execute(query: GetEmployeeByNameQuery): Promise<Employee | null> {
    return this.repo.getEmployeeByName(query.name, query.viewerIsHr);
  }
}
