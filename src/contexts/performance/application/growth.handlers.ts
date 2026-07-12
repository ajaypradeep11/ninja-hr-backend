// src/contexts/performance/application/growth.handlers.ts
// CQRS wiring for continuous performance management (goals / 1-on-1s /
// feedback / kudos). Ownership rules live in GrowthRepository.
import { CommandHandler, ICommandHandler, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { ActorContext } from 'src/platform/auth/actor-context';
import type { FeedbackRequestInput, KudosInput } from '../domain/growth.types';
import { GrowthRepository } from '../infrastructure/growth.repository';

/* ------------------------------ Queries ------------------------------ */

export class GetGrowthQuery {
  constructor(public readonly actor: ActorContext) {}
}

@QueryHandler(GetGrowthQuery)
export class GetGrowthHandler implements IQueryHandler<GetGrowthQuery> {
  constructor(private readonly repo: GrowthRepository) {}
  execute(q: GetGrowthQuery) {
    return this.repo.getGrowth(q.actor);
  }
}

export class ListAllGoalsQuery {}

@QueryHandler(ListAllGoalsQuery)
export class ListAllGoalsHandler implements IQueryHandler<ListAllGoalsQuery> {
  constructor(private readonly repo: GrowthRepository) {}
  execute() {
    return this.repo.listAllGoals();
  }
}

/* ------------------------------ Commands ----------------------------- */

/** Guarded goal re-weighting (15% constructive-dismissal rule). */
export class RequestGoalWeightChangeCommand {
  constructor(
    public readonly goalId: string,
    public readonly previousWeight: number,
    public readonly proposedWeight: number,
    public readonly actor: ActorContext,
  ) {}
}

@CommandHandler(RequestGoalWeightChangeCommand)
export class RequestGoalWeightChangeHandler
  implements ICommandHandler<RequestGoalWeightChangeCommand>
{
  constructor(private readonly repo: GrowthRepository) {}
  execute(c: RequestGoalWeightChangeCommand) {
    return this.repo.requestWeightChange(c.goalId, c.previousWeight, c.proposedWeight, c.actor);
  }
}

export class UpdateGoalProgressCommand {
  constructor(
    public readonly goalId: string,
    public readonly input: { progress: number; note?: string },
    public readonly actor: ActorContext,
  ) {}
}

@CommandHandler(UpdateGoalProgressCommand)
export class UpdateGoalProgressHandler implements ICommandHandler<UpdateGoalProgressCommand> {
  constructor(private readonly repo: GrowthRepository) {}
  execute(c: UpdateGoalProgressCommand) {
    return this.repo.updateGoalProgress(c.goalId, c.input, c.actor);
  }
}

export class AddTalkingPointCommand {
  constructor(
    public readonly syncId: string,
    public readonly text: string,
    public readonly actor: ActorContext,
  ) {}
}

@CommandHandler(AddTalkingPointCommand)
export class AddTalkingPointHandler implements ICommandHandler<AddTalkingPointCommand> {
  constructor(private readonly repo: GrowthRepository) {}
  execute(c: AddTalkingPointCommand) {
    return this.repo.addTalkingPoint(c.syncId, c.text, c.actor);
  }
}

export class RemoveTalkingPointCommand {
  constructor(
    public readonly syncId: string,
    public readonly pointId: string,
    public readonly actor: ActorContext,
  ) {}
}

@CommandHandler(RemoveTalkingPointCommand)
export class RemoveTalkingPointHandler implements ICommandHandler<RemoveTalkingPointCommand> {
  constructor(private readonly repo: GrowthRepository) {}
  execute(c: RemoveTalkingPointCommand) {
    return this.repo.removeTalkingPoint(c.syncId, c.pointId, c.actor);
  }
}

export class AddActionItemCommand {
  constructor(
    public readonly syncId: string,
    public readonly text: string,
    public readonly actor: ActorContext,
  ) {}
}

@CommandHandler(AddActionItemCommand)
export class AddActionItemHandler implements ICommandHandler<AddActionItemCommand> {
  constructor(private readonly repo: GrowthRepository) {}
  execute(c: AddActionItemCommand) {
    return this.repo.addActionItem(c.syncId, c.text, c.actor);
  }
}

export class ToggleActionItemCommand {
  constructor(
    public readonly syncId: string,
    public readonly itemId: string,
    public readonly done: boolean,
    public readonly actor: ActorContext,
  ) {}
}

@CommandHandler(ToggleActionItemCommand)
export class ToggleActionItemHandler implements ICommandHandler<ToggleActionItemCommand> {
  constructor(private readonly repo: GrowthRepository) {}
  execute(c: ToggleActionItemCommand) {
    return this.repo.toggleActionItem(c.syncId, c.itemId, c.done, c.actor);
  }
}

export class RequestFeedbackCommand {
  constructor(
    public readonly input: FeedbackRequestInput,
    public readonly actor: ActorContext,
  ) {}
}

@CommandHandler(RequestFeedbackCommand)
export class RequestFeedbackHandler implements ICommandHandler<RequestFeedbackCommand> {
  constructor(private readonly repo: GrowthRepository) {}
  execute(c: RequestFeedbackCommand) {
    return this.repo.requestFeedback(c.input, c.actor);
  }
}

export class RespondFeedbackCommand {
  constructor(
    public readonly id: string,
    public readonly response: string,
    public readonly actor: ActorContext,
  ) {}
}

@CommandHandler(RespondFeedbackCommand)
export class RespondFeedbackHandler implements ICommandHandler<RespondFeedbackCommand> {
  constructor(private readonly repo: GrowthRepository) {}
  execute(c: RespondFeedbackCommand) {
    return this.repo.respondFeedback(c.id, c.response, c.actor);
  }
}

export class GiveKudosCommand {
  constructor(
    public readonly input: KudosInput,
    public readonly actor: ActorContext,
  ) {}
}

@CommandHandler(GiveKudosCommand)
export class GiveKudosHandler implements ICommandHandler<GiveKudosCommand> {
  constructor(private readonly repo: GrowthRepository) {}
  execute(c: GiveKudosCommand) {
    return this.repo.giveKudos(c.input, c.actor);
  }
}
