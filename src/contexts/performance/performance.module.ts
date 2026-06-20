// src/contexts/performance/performance.module.ts
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PerformanceController } from './interface/performance.controller';
import { PerformanceRepository } from './infrastructure/performance.repository';
import { GetPerformanceReviewsHandler } from './application/queries/get-performance-reviews.query';
import { GetPipsHandler } from './application/queries/get-pips.query';
import { AdvanceReviewStateHandler } from './application/commands/advance-review-state.command';
import { IssuePipHandler } from './application/commands/issue-pip.command';

@Module({
  imports: [CqrsModule],
  controllers: [PerformanceController],
  providers: [
    PerformanceRepository,
    GetPerformanceReviewsHandler,
    GetPipsHandler,
    AdvanceReviewStateHandler,
    IssuePipHandler,
  ],
})
export class PerformanceModule {}
