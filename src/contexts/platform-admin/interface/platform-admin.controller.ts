import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { PlatformAdminGuard } from 'src/platform/auth/platform-admin.guard';
import {
  CreateCompanyCommand,
  DeleteCompanyCommand,
  DeleteUserCommand,
  GetCompanyUsersQuery,
  GetLogsQuery,
  GetOverviewQuery,
} from '../application/platform-admin.handlers';
import { CreateCompanyDto, ListLogsDto } from './dto/platform-admin.dto';
import type { PlatformCompany, PlatformLog, PlatformOverview, PlatformUser } from '../domain/platform-admin.types';

const DEFAULT_LOG_LIMIT = 50;

/**
 * Control-plane routes for the admin console (ninja-hr-admin). Cross-tenant by
 * design, so PlatformAdminGuard requires x-platform-admin-key on top of the
 * global InternalKeyGuard's x-internal-key — two distinct secrets.
 *
 * These routes carry no x-actor-id, so ActorGuard's trusted lane leaves the
 * tenant context unset; that is correct here because the repository uses the raw
 * (unscoped) client rather than the tenant-scoped one.
 */
@ApiTags('platform-admin')
@Controller('platform-admin')
@UseGuards(PlatformAdminGuard)
export class PlatformAdminController {
  constructor(
    private readonly queries: QueryBus,
    private readonly commands: CommandBus,
  ) {}

  @Get('overview')
  overview(): Promise<PlatformOverview> {
    return this.queries.execute(new GetOverviewQuery());
  }

  @Get('logs')
  logs(@Query() dto: ListLogsDto): Promise<PlatformLog[]> {
    return this.queries.execute(new GetLogsQuery(dto.limit ?? DEFAULT_LOG_LIMIT));
  }

  @Get('companies/:id/users')
  companyUsers(@Param('id') id: string): Promise<PlatformUser[]> {
    return this.queries.execute(new GetCompanyUsersQuery(id));
  }

  @Post('companies')
  createCompany(@Body() dto: CreateCompanyDto): Promise<PlatformCompany> {
    return this.commands.execute(new CreateCompanyCommand(dto.name));
  }

  @Delete('companies/:id')
  deleteCompany(@Param('id') id: string): Promise<{ id: string; name: string }> {
    return this.commands.execute(new DeleteCompanyCommand(id));
  }

  @Delete('users/:id')
  deleteUser(@Param('id') id: string): Promise<{ id: string; companyId: string | null }> {
    return this.commands.execute(new DeleteUserCommand(id));
  }
}
