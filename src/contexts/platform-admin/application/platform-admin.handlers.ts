import { CommandHandler, ICommandHandler, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PlatformAdminRepository } from '../infrastructure/platform-admin.repository';
import type { PlatformCompany, PlatformLog, PlatformOverview, PlatformUser } from '../domain/platform-admin.types';

// Grouped in one file (as contexts/platform/calc.handlers.ts already does) —
// each handler is a thin pass-through to the repository, so a file apiece would
// be noise.

export class GetOverviewQuery {}
export class GetCompanyUsersQuery {
  constructor(readonly companyId: string) {}
}
export class GetLogsQuery {
  constructor(readonly limit: number) {}
}
export class CreateCompanyCommand {
  constructor(readonly name: string) {}
}
export class DeleteCompanyCommand {
  constructor(readonly id: string) {}
}
export class DeleteUserCommand {
  constructor(readonly id: string) {}
}

@QueryHandler(GetOverviewQuery)
export class GetOverviewHandler implements IQueryHandler<GetOverviewQuery> {
  constructor(private readonly repo: PlatformAdminRepository) {}
  execute(): Promise<PlatformOverview> {
    return this.repo.overview();
  }
}

@QueryHandler(GetCompanyUsersQuery)
export class GetCompanyUsersHandler implements IQueryHandler<GetCompanyUsersQuery> {
  constructor(private readonly repo: PlatformAdminRepository) {}
  execute(query: GetCompanyUsersQuery): Promise<PlatformUser[]> {
    return this.repo.usersFor(query.companyId);
  }
}

@QueryHandler(GetLogsQuery)
export class GetLogsHandler implements IQueryHandler<GetLogsQuery> {
  constructor(private readonly repo: PlatformAdminRepository) {}
  execute(query: GetLogsQuery): Promise<PlatformLog[]> {
    return this.repo.logs(query.limit);
  }
}

@CommandHandler(CreateCompanyCommand)
export class CreateCompanyHandler implements ICommandHandler<CreateCompanyCommand> {
  constructor(private readonly repo: PlatformAdminRepository) {}
  execute(command: CreateCompanyCommand): Promise<PlatformCompany> {
    return this.repo.createCompany(command.name);
  }
}

@CommandHandler(DeleteCompanyCommand)
export class DeleteCompanyHandler implements ICommandHandler<DeleteCompanyCommand> {
  constructor(private readonly repo: PlatformAdminRepository) {}
  execute(command: DeleteCompanyCommand): Promise<{ id: string; name: string }> {
    return this.repo.deleteCompany(command.id);
  }
}

@CommandHandler(DeleteUserCommand)
export class DeleteUserHandler implements ICommandHandler<DeleteUserCommand> {
  constructor(private readonly repo: PlatformAdminRepository) {}
  execute(command: DeleteUserCommand): Promise<{ id: string; companyId: string | null }> {
    return this.repo.deleteUser(command.id);
  }
}

export const PLATFORM_ADMIN_HANDLERS = [
  GetOverviewHandler,
  GetCompanyUsersHandler,
  GetLogsHandler,
  CreateCompanyHandler,
  DeleteCompanyHandler,
  DeleteUserHandler,
];
