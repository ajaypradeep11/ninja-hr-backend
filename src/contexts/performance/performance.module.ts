// src/contexts/performance/performance.module.ts
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PerformanceController } from './interface/performance.controller';
import { PerformanceRepository } from './infrastructure/performance.repository';
import { GrowthRepository } from './infrastructure/growth.repository';
import { GetPerformanceReviewsHandler } from './application/queries/get-performance-reviews.query';
import { GetPipsHandler } from './application/queries/get-pips.query';
import { AdvanceReviewStateHandler } from './application/commands/advance-review-state.command';
import { IssuePipHandler } from './application/commands/issue-pip.command';
import { RunProbationSweepHandler } from './application/commands/run-probation-sweep.command';
import {
  AddActionItemHandler,
  AddTalkingPointHandler,
  GetGrowthHandler,
  GiveKudosHandler,
  ListAllGoalsHandler,
  RemoveTalkingPointHandler,
  RequestFeedbackHandler,
  RequestGoalWeightChangeHandler,
  RespondFeedbackHandler,
  ToggleActionItemHandler,
  UpdateGoalProgressHandler,
} from './application/growth.handlers';

@Module({
  imports: [CqrsModule],
  controllers: [PerformanceController],
  providers: [
    PerformanceRepository,
    GrowthRepository,
    GetPerformanceReviewsHandler,
    GetPipsHandler,
    AdvanceReviewStateHandler,
    IssuePipHandler,
    RunProbationSweepHandler,
    GetGrowthHandler,
    ListAllGoalsHandler,
    RequestGoalWeightChangeHandler,
    UpdateGoalProgressHandler,
    AddTalkingPointHandler,
    RemoveTalkingPointHandler,
    AddActionItemHandler,
    ToggleActionItemHandler,
    RequestFeedbackHandler,
    RespondFeedbackHandler,
    GiveKudosHandler,
  ],
})
export class PerformanceModule {}
