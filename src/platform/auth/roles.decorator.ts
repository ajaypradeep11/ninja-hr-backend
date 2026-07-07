// src/platform/auth/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import type { ActorRole } from './actor-context';

export const ROLES_KEY = 'requiredRoles';

/** Route-level role gate. Routes without @Roles() allow any caller. */
export const Roles = (...roles: ActorRole[]) => SetMetadata(ROLES_KEY, roles);
