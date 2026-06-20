// src/contexts/performance/interface/performance.controller.ts
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { GetPerformanceReviewsQuery } from '../application/queries/get-performance-reviews.query';
import { GetPipsQuery } from '../application/queries/get-pips.query';
import { AdvanceReviewStateCommand } from '../application/commands/advance-review-state.command';
import { IssuePipCommand } from '../application/commands/issue-pip.command';
import { IssuePipDto } from './dto/performance.dto';

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
}
