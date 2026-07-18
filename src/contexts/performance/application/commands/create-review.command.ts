// src/contexts/performance/application/commands/create-review.command.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PerformanceRepository, type NewReviewInput } from '../../infrastructure/performance.repository';
import type { PerformanceReview } from '../../domain/performance.types';

export class CreateReviewCommand {
  constructor(public readonly input: NewReviewInput) {}
}

@CommandHandler(CreateReviewCommand)
export class CreateReviewHandler implements ICommandHandler<CreateReviewCommand, PerformanceReview[]> {
  constructor(private readonly repo: PerformanceRepository) {}

  execute({ input }: CreateReviewCommand): Promise<PerformanceReview[]> {
    return this.repo.createReview(input);
  }
}
