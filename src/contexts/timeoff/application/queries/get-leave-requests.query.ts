// src/contexts/timeoff/application/queries/get-leave-requests.query.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { TimeoffRepository } from '../../infrastructure/timeoff.repository';
import type { ActorContext } from 'src/platform/auth/actor-context';
import type { LeaveRequest } from '../../domain/timeoff.types';

export class GetLeaveRequestsQuery {
  constructor(public readonly actor?: ActorContext) {}
}

@QueryHandler(GetLeaveRequestsQuery)
export class GetLeaveRequestsHandler
  implements IQueryHandler<GetLeaveRequestsQuery, LeaveRequest[]>
{
  constructor(private readonly repo: TimeoffRepository) {}

  execute({ actor }: GetLeaveRequestsQuery): Promise<LeaveRequest[]> {
    // Scoping is the routing: HR = all, manager = own + direct reports
    // (by reporting line), employee = own.
    return this.repo.getLeaveRequests(actor);
  }
}
