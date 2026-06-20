// src/contexts/platform/application/commands/create-agent-run.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PlatformRepository } from '../../infrastructure/platform.repository';
import type { AgentRun } from '../../domain/platform.types';

export class CreateAgentRunCommand {
  constructor(public readonly intent: string) {}
}

@CommandHandler(CreateAgentRunCommand)
export class CreateAgentRunHandler
  implements ICommandHandler<CreateAgentRunCommand, AgentRun[]>
{
  constructor(private readonly repo: PlatformRepository) {}
  execute({ intent }: CreateAgentRunCommand): Promise<AgentRun[]> {
    return this.repo.createAgentRun(intent);
  }
}
