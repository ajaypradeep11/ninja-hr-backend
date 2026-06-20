import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type Persona = 'admin' | 'employee';

// Defaults to least privilege: anything that is not exactly 'admin' is treated
// as 'employee'. The trusted server (Next.js BFF) always sends an explicit persona.
export const Actor = createParamDecorator((_data: unknown, ctx: ExecutionContext): Persona => {
  const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
  return req.headers['x-actor-persona'] === 'admin' ? 'admin' : 'employee';
});
