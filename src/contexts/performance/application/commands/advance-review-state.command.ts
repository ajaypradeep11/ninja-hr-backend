// src/contexts/performance/application/commands/advance-review-state.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PerformanceRepository } from '../../infrastructure/performance.repository';
import type { PerformanceReview } from '../../domain/performance.types';

export class AdvanceReviewStateCommand {
  constructor(public readonly id: string) {}
}

@CommandHandler(AdvanceReviewStateCommand)
export class AdvanceReviewStateHandler
  implements ICommandHandler<AdvanceReviewStateCommand, PerformanceReview[]>
{
  constructor(private readonly repo: PerformanceRepository) {}

  execute({ id }: AdvanceReviewStateCommand): Promise<PerformanceReview[]> {
    return this.repo.advanceReviewState(id);
  }
}
