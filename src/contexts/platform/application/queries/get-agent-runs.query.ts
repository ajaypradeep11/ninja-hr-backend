// src/contexts/platform/application/queries/get-agent-runs.query.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PlatformRepository } from '../../infrastructure/platform.repository';
import type { AgentRun } from '../../domain/platform.types';

export class GetAgentRunsQuery {}

@QueryHandler(GetAgentRunsQuery)
export class GetAgentRunsHandler implements IQueryHandler<GetAgentRunsQuery, AgentRun[]> {
  constructor(private readonly repo: PlatformRepository) {}
  execute(): Promise<AgentRun[]> {
    return this.repo.getAgentRuns();
  }
}
