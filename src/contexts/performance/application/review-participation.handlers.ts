// src/contexts/performance/application/review-participation.handlers.ts
// Actor-scoped review participation: the employee's self-assessment, the
// assigned manager's evaluation, and the employee's acknowledgment. All
// relationship checks live in PerformanceRepository (reporting line), not in
// @Roles — mirrors how candidate-scoped recruitment routes work.
import { CommandHandler, ICommandHandler, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { ActorContext } from 'src/platform/auth/actor-context';
import { PerformanceRepository } from '../infrastructure/performance.repository';
import type { MyReviews } from '../domain/performance.types';

export class GetMyReviewsQuery {
  constructor(public readonly actor: ActorContext) {}
}

@QueryHandler(GetMyReviewsQuery)
export class GetMyReviewsHandler implements IQueryHandler<GetMyReviewsQuery, MyReviews> {
  constructor(private readonly repo: PerformanceRepository) {}
  execute({ actor }: GetMyReviewsQuery): Promise<MyReviews> {
    return this.repo.getMyReviews(actor);
  }
}

export class SubmitSelfEvaluationCommand {
  constructor(
    public readonly id: string,
    public readonly text: string,
    public readonly actor: ActorContext,
  ) {}
}

@CommandHandler(SubmitSelfEvaluationCommand)
export class SubmitSelfEvaluationHandler
  implements ICommandHandler<SubmitSelfEvaluationCommand, MyReviews>
{
  constructor(private readonly repo: PerformanceRepository) {}
  execute({ id, text, actor }: SubmitSelfEvaluationCommand): Promise<MyReviews> {
    return this.repo.submitSelfEvaluation(id, text, actor);
  }
}

export class SubmitManagerEvaluationCommand {
  constructor(
    public readonly id: string,
    public readonly text: string,
    public readonly score: number | undefined,
    public readonly actor: ActorContext,
  ) {}
}

@CommandHandler(SubmitManagerEvaluationCommand)
export class SubmitManagerEvaluationHandler
  implements ICommandHandler<SubmitManagerEvaluationCommand, MyReviews>
{
  constructor(private readonly repo: PerformanceRepository) {}
  execute({ id, text, score, actor }: SubmitManagerEvaluationCommand): Promise<MyReviews> {
    return this.repo.submitManagerEvaluation(id, text, score, actor);
  }
}

export class AcknowledgeReviewCommand {
  constructor(
    public readonly id: string,
    public readonly actor: ActorContext,
  ) {}
}

@CommandHandler(AcknowledgeReviewCommand)
export class AcknowledgeReviewHandler
  implements ICommandHandler<AcknowledgeReviewCommand, MyReviews>
{
  constructor(private readonly repo: PerformanceRepository) {}
  execute({ id, actor }: AcknowledgeReviewCommand): Promise<MyReviews> {
    return this.repo.acknowledgeReview(id, actor);
  }
}
