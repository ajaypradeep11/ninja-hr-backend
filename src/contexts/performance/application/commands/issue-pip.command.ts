// src/contexts/performance/application/commands/issue-pip.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PerformanceRepository, NewPipInput } from '../../infrastructure/performance.repository';
import type { Pip } from '../../domain/performance.types';

export class IssuePipCommand {
  constructor(public readonly input: NewPipInput) {}
}

@CommandHandler(IssuePipCommand)
export class IssuePipHandler implements ICommandHandler<IssuePipCommand, Pip[]> {
  constructor(private readonly repo: PerformanceRepository) {}

  execute({ input }: IssuePipCommand): Promise<Pip[]> {
    return this.repo.issuePip(input);
  }
}
