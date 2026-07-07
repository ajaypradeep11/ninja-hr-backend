// src/contexts/identity/application/queries/get-user-by-id.query.ts
import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IdentityRepository } from '../../infrastructure/identity.repository';
import type { UserAccount } from '../../domain/identity.types';

export class GetUserByIdQuery {
  constructor(public readonly id: string) {}
}

@QueryHandler(GetUserByIdQuery)
export class GetUserByIdHandler implements IQueryHandler<GetUserByIdQuery, UserAccount> {
  constructor(private readonly repo: IdentityRepository) {}
  async execute({ id }: GetUserByIdQuery): Promise<UserAccount> {
    const user = await this.repo.getUserById(id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }
}
