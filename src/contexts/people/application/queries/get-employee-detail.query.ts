// src/contexts/people/application/queries/get-employee-detail.query.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PeopleRepository } from '../../infrastructure/people.repository';
import type { EmployeeDetail } from '../../domain/people.types';

export class GetEmployeeDetailQuery {
  constructor(public readonly id: string) {}
}

@QueryHandler(GetEmployeeDetailQuery)
export class GetEmployeeDetailHandler
  implements IQueryHandler<GetEmployeeDetailQuery, EmployeeDetail>
{
  constructor(private readonly repo: PeopleRepository) {}
  execute({ id }: GetEmployeeDetailQuery): Promise<EmployeeDetail> {
    return this.repo.getEmployeeDetail(id);
  }
}
