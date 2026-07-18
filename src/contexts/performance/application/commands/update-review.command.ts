// src/contexts/performance/application/commands/update-review.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PerformanceRepository, type UpdateReviewInput } from '../../infrastructure/performance.repository';
import type { PerformanceReview } from '../../domain/performance.types';

export class UpdateReviewCommand {
  constructor(
    public readonly id: string,
    public readonly input: UpdateReviewInput,
  ) {}
}

@CommandHandler(UpdateReviewCommand)
export class UpdateReviewHandler implements ICommandHandler<UpdateReviewCommand, PerformanceReview[]> {
  constructor(private readonly repo: PerformanceRepository) {}

  execute({ id, input }: UpdateReviewCommand): Promise<PerformanceReview[]> {
    return this.repo.updateReview(id, input);
  }
}
