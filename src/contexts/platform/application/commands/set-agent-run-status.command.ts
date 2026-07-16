// src/contexts/platform/application/commands/set-agent-run-status.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PlatformRepository } from '../../infrastructure/platform.repository';
import type { AgentRun, AgentStatus } from '../../domain/platform.types';
import { MassLetterApprovalService } from 'src/contexts/workplace/infrastructure/mass-letter-approval.service';

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
  constructor(private readonly repo: PlatformRepository, private readonly massLetters: MassLetterApprovalService) {}
  async execute({ id, status }: SetAgentRunStatusCommand): Promise<AgentRun[]> {
    if (status === 'Completed') {
      const handled = await this.massLetters.tryApprove(id);
      if (handled) return this.repo.getAgentRuns();
    }
    return this.repo.setAgentRunStatus(id, status);
  }
}
