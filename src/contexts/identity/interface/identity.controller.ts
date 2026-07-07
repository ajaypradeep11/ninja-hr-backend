// src/contexts/identity/interface/identity.controller.ts
import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { QueryBus } from '@nestjs/cqrs';
import { GetUsersQuery } from '../application/queries/get-users.query';
import { GetUserByIdQuery } from '../application/queries/get-user-by-id.query';

@ApiTags('identity')
@Controller('identity')
export class IdentityController {
  constructor(private readonly queries: QueryBus) {}

  /** Switchable demo logins for the frontend user switcher. */
  @Get('users')
  getUsers() {
    return this.queries.execute(new GetUsersQuery());
  }

  @Get('users/:id')
  getUserById(@Param('id') id: string) {
    return this.queries.execute(new GetUserByIdQuery(id));
  }
}
