import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
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
    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string> }>();
    if (req.headers['x-internal-key'] !== process.env.INTERNAL_API_KEY) {
      throw new UnauthorizedException('invalid internal key');
    }
    return true;
  }
}
