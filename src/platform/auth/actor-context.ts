// src/platform/auth/actor-context.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type ActorRole = 'HR_ADMIN' | 'MANAGER' | 'EMPLOYEE';

/** Resolved caller identity, attached to the request by ActorGuard. */
export interface ActorContext {
  /** User id from x-actor-id, or null when running on the legacy persona fallback. */
  userId: string | null;
  employeeId: string | null;
  employeeName: string | null;
  department: string | null;
  role: ActorRole;
  /** The verified user when impersonating via x-actor-id; equals userId otherwise. */
  realUserId: string | null;
  /** The caller's tenant. null on the persona-only fallback (no tenant data access). */
  companyId: string | null;
}

/** Injects the resolved ActorContext (set by ActorGuard) into a handler param. */
export const ActorCtx = createParamDecorator((_data: unknown, ctx: ExecutionContext): ActorContext => {
  const req = ctx.switchToHttp().getRequest<{ actor?: ActorContext }>();
  // ActorGuard always runs first; the fallback covers direct unit-test calls.
  return (
    req.actor ?? {
      userId: null,
      employeeId: null,
      employeeName: null,
      department: null,
      role: 'EMPLOYEE',
      realUserId: null,
      companyId: null,
    }
  );
});
