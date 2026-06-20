// src/contexts/offboarding/application/queries/get-offboarding-tasks.query.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { OffboardingRepository } from '../../infrastructure/offboarding.repository';
import type { OffboardingTask } from '../../domain/offboarding.types';

export class GetOffboardingTasksQuery {}

@QueryHandler(GetOffboardingTasksQuery)
export class GetOffboardingTasksHandler
  implements IQueryHandler<GetOffboardingTasksQuery, OffboardingTask[]>
{
  constructor(private readonly repo: OffboardingRepository) {}

  execute(): Promise<OffboardingTask[]> {
    return this.repo.getTasks();
  }
}
