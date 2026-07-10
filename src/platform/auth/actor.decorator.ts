import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { ActorContext } from './actor-context';

export type Persona = 'admin' | 'employee';

// Persona is derived from the VERIFIED actor role resolved by ActorGuard — not
// from the raw `x-actor-persona` header. Reading the header directly let a
// Firebase-authenticated EMPLOYEE send `x-actor-persona: admin` and obtain the
// admin-scoped copilot persona. Defaults to least privilege.
export const Actor = createParamDecorator((_data: unknown, ctx: ExecutionContext): Persona => {
  const req = ctx.switchToHttp().getRequest<{ actor?: ActorContext }>();
  return req.actor?.role === 'HR_ADMIN' ? 'admin' : 'employee';
});
