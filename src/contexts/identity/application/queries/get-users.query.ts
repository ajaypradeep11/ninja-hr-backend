// src/contexts/identity/application/queries/get-users.query.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IdentityRepository } from '../../infrastructure/identity.repository';
import type { UserAccount } from '../../domain/identity.types';

export class GetUsersQuery {}

@QueryHandler(GetUsersQuery)
export class GetUsersHandler implements IQueryHandler<GetUsersQuery, UserAccount[]> {
  constructor(private readonly repo: IdentityRepository) {}
  execute(): Promise<UserAccount[]> {
    return this.repo.getUsers();
  }
}
