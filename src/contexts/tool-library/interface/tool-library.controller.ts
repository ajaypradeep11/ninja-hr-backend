// HTTP boundary for the Tool Library (premium AI tool add-on).
//
// Access model: HR_ADMIN ("Super Admin") manages the library — company-wide
// toggles and per-user grants. Listing and running are open to every
// authenticated role; the handlers decide per-tool visibility/executability
// from company settings + the caller's grants, so a MANAGER only ever sees
// and runs what an admin assigned to them.

import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ActorCtx, type ActorContext } from 'src/platform/auth/actor-context';
import { Roles } from 'src/platform/auth/roles.decorator';
import { RunToolCommand } from '../application/commands/run-tool.command';
import { SetToolEnabledCommand } from '../application/commands/set-tool-enabled.command';
import { SetToolGrantsCommand } from '../application/commands/set-tool-grants.command';
import { GetToolAccessQuery } from '../application/queries/get-tool-access.query';
import { ListToolsQuery } from '../application/queries/list-tools.query';
import {
  ListToolsDto,
  RunToolDto,
  SetToolEnabledDto,
  SetToolGrantsDto,
} from './dto/tool-library.dto';

@ApiTags('tools')
@Controller('tools')
export class ToolLibraryController {
  constructor(
    private readonly queries: QueryBus,
    private readonly commands: CommandBus,
  ) {}

  @Get()
  listTools(@Query() query: ListToolsDto, @ActorCtx() actor: ActorContext) {
    return this.queries.execute(new ListToolsQuery(actor, query.surface));
  }

  @Get(':slug/access')
  @Roles('HR_ADMIN')
  getToolAccess(@Param('slug') slug: string) {
    return this.queries.execute(new GetToolAccessQuery(slug));
  }

  @Put(':slug/enabled')
  @Roles('HR_ADMIN')
  setToolEnabled(@Param('slug') slug: string, @Body() body: SetToolEnabledDto) {
    return this.commands.execute(new SetToolEnabledCommand(slug, body.enabled));
  }

  @Put(':slug/grants')
  @Roles('HR_ADMIN')
  setToolGrants(@Param('slug') slug: string, @Body() body: SetToolGrantsDto) {
    return this.commands.execute(new SetToolGrantsCommand(slug, body.userIds));
  }

  @Post(':slug/run')
  runTool(@Param('slug') slug: string, @Body() body: RunToolDto, @ActorCtx() actor: ActorContext) {
    return this.commands.execute(new RunToolCommand(slug, body.inputs, actor));
  }
}
