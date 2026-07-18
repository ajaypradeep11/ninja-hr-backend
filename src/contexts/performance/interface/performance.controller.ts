// src/contexts/performance/interface/performance.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ActorCtx, type ActorContext } from 'src/platform/auth/actor-context';
import { Roles } from 'src/platform/auth/roles.decorator';
import { GetPerformanceReviewsQuery } from '../application/queries/get-performance-reviews.query';
import { GetPipsQuery } from '../application/queries/get-pips.query';
import { AdvanceReviewStateCommand } from '../application/commands/advance-review-state.command';
import { CreateReviewCommand } from '../application/commands/create-review.command';
import { UpdateReviewCommand } from '../application/commands/update-review.command';
import { IssuePipCommand } from '../application/commands/issue-pip.command';
import { RunProbationSweepCommand } from '../application/commands/run-probation-sweep.command';
import {
  AddActionItemCommand,
  AddTalkingPointCommand,
  GetGrowthQuery,
  GiveKudosCommand,
  ListAllGoalsQuery,
  RemoveTalkingPointCommand,
  RequestFeedbackCommand,
  RequestGoalWeightChangeCommand,
  RespondFeedbackCommand,
  ToggleActionItemCommand,
  UpdateGoalProgressCommand,
} from '../application/growth.handlers';
import {
  ActionItemDto,
  CreateReviewDto,
  FeedbackRequestDto,
  FeedbackResponseDto,
  GoalProgressDto,
  GoalWeightChangeDto,
  IssuePipDto,
  KudosDto,
  TalkingPointDto,
  ToggleActionItemDto,
  UpdateReviewDto,
} from './dto/performance.dto';

@ApiTags('performance')
@Controller('performance')
export class PerformanceController {
  constructor(
    private readonly queries: QueryBus,
    private readonly commands: CommandBus,
  ) {}

  // Reviews and PIPs are company-wide HR records with no per-actor scoping in
  // their handlers, so they are HR-only. (Managers get the self-scoped growth
  // surface below.) Without these gates any employee could read every
  // colleague's review/PIP or issue a PIP against anyone.
  @Get('reviews')
  @Roles('HR_ADMIN')
  getReviews() {
    return this.queries.execute(new GetPerformanceReviewsQuery());
  }

  /** Start a review for an employee (begins in Draft). */
  @Post('reviews')
  @Roles('HR_ADMIN')
  createReview(@Body() body: CreateReviewDto) {
    return this.commands.execute(
      new CreateReviewCommand({ employeeId: body.employeeId, cycle: body.cycle, due: body.due }),
    );
  }

  /** Fill in review content (self/manager evaluation, score). */
  @Patch('reviews/:id')
  @Roles('HR_ADMIN')
  updateReview(@Param('id') id: string, @Body() body: UpdateReviewDto) {
    return this.commands.execute(
      new UpdateReviewCommand(id, {
        selfEvaluation: body.selfEvaluation,
        managerEvaluation: body.managerEvaluation,
        score: body.score,
      }),
    );
  }

  @Get('pips')
  @Roles('HR_ADMIN')
  getPips() {
    return this.queries.execute(new GetPipsQuery());
  }

  @Post('reviews/:id/advance')
  @Roles('HR_ADMIN')
  advanceReviewState(@Param('id') id: string) {
    return this.commands.execute(new AdvanceReviewStateCommand(id));
  }

  /** Day-60 initialize / Day-80 escalate probationary automation — invoked
   *  when HR opens the Performance dashboard (no cron infra exists). */
  @Post('probation/sweep')
  @Roles('HR_ADMIN')
  runProbationSweep() {
    return this.commands.execute(new RunProbationSweepCommand());
  }

  @Post('pips')
  @Roles('HR_ADMIN')
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

  /** Company-wide goal list for the admin weight-change guardrail flow. */
  @Get('growth/goals')
  @Roles('HR_ADMIN')
  listAllGoals() {
    return this.queries.execute(new ListAllGoalsQuery());
  }

  /** Re-weight a goal — blocked past the 15% constructive-dismissal rule. */
  @Patch('growth/goals/:id/weight')
  requestGoalWeightChange(
    @Param('id') id: string,
    @Body() body: GoalWeightChangeDto,
    @ActorCtx() actor: ActorContext,
  ) {
    return this.commands.execute(
      new RequestGoalWeightChangeCommand(id, body.previousWeight, body.proposedWeight, actor),
    );
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
