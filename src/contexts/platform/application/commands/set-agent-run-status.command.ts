// src/contexts/platform/application/commands/set-agent-run-status.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PlatformRepository } from '../../infrastructure/platform.repository';
import type { AgentRun, AgentStatus } from '../../domain/platform.types';

export class SetAgentRunStatusCommand {
  constructor(
    public readonly id: string,
    public readonly status: AgentStatus,
  ) {}
}

@CommandHandler(SetAgentRunStatusCommand)
export class SetAgentRunStatusHandler
  implements ICommandHandler<SetAgentRunStatusCommand, AgentRun[]>
{
  constructor(private readonly repo: PlatformRepository) {}
  execute({ id, status }: SetAgentRunStatusCommand): Promise<AgentRun[]> {
    return this.repo.setAgentRunStatus(id, status);
  }
}
