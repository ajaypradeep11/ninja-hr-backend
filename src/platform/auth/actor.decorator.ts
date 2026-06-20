import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type Persona = 'admin' | 'employee';

export const Actor = createParamDecorator((_data: unknown, ctx: ExecutionContext): Persona => {
  const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string> }>();
  return req.headers['x-actor-persona'] === 'employee' ? 'employee' : 'admin';
});
