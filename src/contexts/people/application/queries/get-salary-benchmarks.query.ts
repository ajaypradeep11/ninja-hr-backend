import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PeopleRepository } from '../../infrastructure/people.repository';
import type { SalaryBenchmark } from '../../domain/people.types';

export class GetSalaryBenchmarksQuery {}

@QueryHandler(GetSalaryBenchmarksQuery)
export class GetSalaryBenchmarksHandler
  implements IQueryHandler<GetSalaryBenchmarksQuery, SalaryBenchmark[]>
{
  constructor(private readonly repo: PeopleRepository) {}
  execute(): Promise<SalaryBenchmark[]> {
    return this.repo.salaryBenchmarks();
  }
}
