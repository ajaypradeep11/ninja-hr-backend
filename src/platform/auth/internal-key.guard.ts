import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'node:crypto';
import { IS_PUBLIC } from './public.decorator';

@Injectable()
export class InternalKeyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    // Fail closed: a missing server-side key never opens a hole.
    const expected = process.env.INTERNAL_API_KEY;
    if (!expected) throw new UnauthorizedException('internal key not configured');

    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const provided = req.headers['x-internal-key'];
    if (typeof provided !== 'string') throw new UnauthorizedException('invalid internal key');

    // Constant-time comparison to avoid leaking the key via timing.
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('invalid internal key');
    }
    return true;
  }
}
