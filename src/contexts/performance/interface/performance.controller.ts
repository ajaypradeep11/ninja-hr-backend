// src/contexts/performance/interface/performance.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ActorCtx, type ActorContext } from 'src/platform/auth/actor-context';
import { GetPerformanceReviewsQuery } from '../application/queries/get-performance-reviews.query';
import { GetPipsQuery } from '../application/queries/get-pips.query';
import { AdvanceReviewStateCommand } from '../application/commands/advance-review-state.command';
import { IssuePipCommand } from '../application/commands/issue-pip.command';
import {
  AddActionItemCommand,
  AddTalkingPointCommand,
  GetGrowthQuery,
  GiveKudosCommand,
  RemoveTalkingPointCommand,
  RequestFeedbackCommand,
  RespondFeedbackCommand,
  ToggleActionItemCommand,
  UpdateGoalProgressCommand,
} from '../application/growth.handlers';
import {
  ActionItemDto,
  FeedbackRequestDto,
  FeedbackResponseDto,
  GoalProgressDto,
  IssuePipDto,
  KudosDto,
  TalkingPointDto,
  ToggleActionItemDto,
} from './dto/performance.dto';

@ApiTags('performance')
@Controller('performance')
export class PerformanceController {
  constructor(
    private readonly queries: QueryBus,
    private readonly commands: CommandBus,
  ) {}

  @Get('reviews')
  getReviews() {
    return this.queries.execute(new GetPerformanceReviewsQuery());
  }

  @Get('pips')
  getPips() {
    return this.queries.execute(new GetPipsQuery());
  }

  @Post('reviews/:id/advance')
  advanceReviewState(@Param('id') id: string) {
    return this.commands.execute(new AdvanceReviewStateCommand(id));
  }

  @Post('pips')
  issuePip(@Body() body: IssuePipDto) {
    return this.commands.execute(
      new IssuePipCommand({
        employee: body.employee,
        manager: body.manager,
        durationDays: body.durationDays,
      }),
    );
  }

  /* --------------- Continuous performance (growth) ---------------- */
  // All actor-scoped: ownership and agenda-access rules live in GrowthRepository.

  /** Everything the employee growth page needs, scoped to the actor. */
  @Get('growth')
  getGrowth(@ActorCtx() actor: ActorContext) {
    return this.queries.execute(new GetGrowthQuery(actor));
  }

  /** Log a progress update on one of the actor's goals (weekly cadence). */
  @Patch('growth/goals/:id/progress')
  updateGoalProgress(
    @Param('id') id: string,
    @Body() body: GoalProgressDto,
    @ActorCtx() actor: ActorContext,
  ) {
    return this.commands.execute(new UpdateGoalProgressCommand(id, body, actor));
  }

  /** Shared 1-on-1 agenda — employee, their manager, and HR can append. */
  @Post('growth/syncs/:id/talking-points')
  addTalkingPoint(
    @Param('id') id: string,
    @Body() body: TalkingPointDto,
    @ActorCtx() actor: ActorContext,
  ) {
    return this.commands.execute(new AddTalkingPointCommand(id, body.text, actor));
  }

  @Delete('growth/syncs/:id/talking-points/:pointId')
  removeTalkingPoint(
    @Param('id') id: string,
    @Param('pointId') pointId: string,
    @ActorCtx() actor: ActorContext,
  ) {
    return this.commands.execute(new RemoveTalkingPointCommand(id, pointId, actor));
  }

  @Post('growth/syncs/:id/action-items')
  addActionItem(
    @Param('id') id: string,
    @Body() body: ActionItemDto,
    @ActorCtx() actor: ActorContext,
  ) {
    return this.commands.execute(new AddActionItemCommand(id, body.text, actor));
  }

  @Patch('growth/syncs/:id/action-items/:itemId')
  toggleActionItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: ToggleActionItemDto,
    @ActorCtx() actor: ActorContext,
  ) {
    return this.commands.execute(new ToggleActionItemCommand(id, itemId, body.done, actor));
  }

  /** Ask a colleague for insights on a recent project. */
  @Post('growth/feedback-requests')
  requestFeedback(@Body() body: FeedbackRequestDto, @ActorCtx() actor: ActorContext) {
    return this.commands.execute(new RequestFeedbackCommand(body, actor));
  }

  /** Answer a feedback request addressed to the actor. */
  @Post('growth/feedback-requests/:id/respond')
  respondFeedback(
    @Param('id') id: string,
    @Body() body: FeedbackResponseDto,
    @ActorCtx() actor: ActorContext,
  ) {
    return this.commands.execute(new RespondFeedbackCommand(id, body.response, actor));
  }

  /** Public praise for a teammate — lands in their recognition feed. */
  @Post('growth/kudos')
  giveKudos(@Body() body: KudosDto, @ActorCtx() actor: ActorContext) {
    return this.commands.execute(new GiveKudosCommand(body, actor));
  }
}
