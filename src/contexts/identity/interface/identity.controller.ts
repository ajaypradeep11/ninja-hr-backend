// src/contexts/identity/interface/identity.controller.ts
import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { QueryBus } from '@nestjs/cqrs';
import { ActorCtx, type ActorContext } from 'src/platform/auth/actor-context';
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

  /**
   * The authenticated caller's own identity. Shape mirrors `users` items plus
   * `realUserId` (the verified caller, distinct from `userId` while an
   * HR_ADMIN is impersonating via x-actor-id).
   */
  @Get('me')
  async me(@ActorCtx() actor: ActorContext) {
    // Trusted-lane persona fallback has no user id; report the coarse role.
    if (!actor.userId) {
      return {
        id: null, employeeId: null, name: null, title: null,
        department: null, role: actor.role, roleCode: actor.role, realUserId: null,
      };
    }
    const user = await this.queries.execute(new GetUserByIdQuery(actor.userId));
    return { ...user, realUserId: actor.realUserId };
  }
}
