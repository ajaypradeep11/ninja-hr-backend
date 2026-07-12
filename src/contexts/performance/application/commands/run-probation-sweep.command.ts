// src/contexts/performance/application/commands/run-probation-sweep.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  PerformanceRepository,
  type ProbationSweepResult,
} from '../../infrastructure/performance.repository';

/** Day-60 initialize / Day-80 escalate probationary automation sweep. */
export class RunProbationSweepCommand {}

@CommandHandler(RunProbationSweepCommand)
export class RunProbationSweepHandler
  implements ICommandHandler<RunProbationSweepCommand, ProbationSweepResult>
{
  constructor(private readonly repo: PerformanceRepository) {}

  execute(): Promise<ProbationSweepResult> {
    return this.repo.runProbationSweep();
  }
}
