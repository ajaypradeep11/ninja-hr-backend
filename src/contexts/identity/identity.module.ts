// src/contexts/identity/identity.module.ts
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { IdentityController } from './interface/identity.controller';
import { IdentityRepository } from './infrastructure/identity.repository';
import { GetUsersHandler } from './application/queries/get-users.query';
import { GetUserByIdHandler } from './application/queries/get-user-by-id.query';

@Module({
  imports: [CqrsModule],
  controllers: [IdentityController],
  providers: [IdentityRepository, GetUsersHandler, GetUserByIdHandler],
})
export class IdentityModule {}
