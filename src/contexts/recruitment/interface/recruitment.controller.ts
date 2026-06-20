// src/contexts/recruitment/interface/recruitment.controller.ts
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { GetRequisitionsQuery } from '../application/queries/get-requisitions.query';
import { GetCandidatesQuery } from '../application/queries/get-candidates.query';
import { PublishRequisitionCommand } from '../application/commands/publish-requisition.command';
import { SetCandidateStageCommand } from '../application/commands/set-candidate-stage.command';
import { PublishRequisitionDto, SetCandidateStageDto } from './dto/recruitment.dto';

@ApiTags('recruitment')
@Controller('recruitment')
export class RecruitmentController {
  constructor(
    private readonly queries: QueryBus,
    private readonly commands: CommandBus,
  ) {}

  @Get('requisitions')
  getRequisitions() {
    return this.queries.execute(new GetRequisitionsQuery());
  }

  @Get('candidates')
  getCandidates() {
    return this.queries.execute(new GetCandidatesQuery());
  }

  @Post('requisitions')
  publishRequisition(@Body() body: PublishRequisitionDto) {
    return this.commands.execute(
      new PublishRequisitionCommand({
        title: body.title,
        department: body.department,
        province: body.province,
        salaryMin: body.salaryMin,
        salaryMax: body.salaryMax,
      }),
    );
  }

  @Patch('candidates/:id/stage')
  setCandidateStage(@Param('id') id: string, @Body() body: SetCandidateStageDto) {
    return this.commands.execute(new SetCandidateStageCommand(id, body.stage));
  }
}
