// src/contexts/timeoff/application/queries/get-leave-requests.query.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { TimeoffRepository } from '../../infrastructure/timeoff.repository';
import type { LeaveRequest } from '../../domain/timeoff.types';

export class GetLeaveRequestsQuery {}

@QueryHandler(GetLeaveRequestsQuery)
export class GetLeaveRequestsHandler
  implements IQueryHandler<GetLeaveRequestsQuery, LeaveRequest[]>
{
  constructor(private readonly repo: TimeoffRepository) {}

  execute(): Promise<LeaveRequest[]> {
    return this.repo.getLeaveRequests();
  }
}
