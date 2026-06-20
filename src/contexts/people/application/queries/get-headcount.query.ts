import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PeopleRepository } from '../../infrastructure/people.repository';

export class GetHeadcountQuery {}

@QueryHandler(GetHeadcountQuery)
export class GetHeadcountHandler
  implements IQueryHandler<GetHeadcountQuery, { dept: string; count: number }[]>
{
  constructor(private readonly repo: PeopleRepository) {}
  execute(): Promise<{ dept: string; count: number }[]> {
    return this.repo.headcountByDept();
  }
}
