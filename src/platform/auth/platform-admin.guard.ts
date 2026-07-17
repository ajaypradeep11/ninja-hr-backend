import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';

interface AdminRequest {
  headers: Record<string, string | undefined>;
}

/**
 * Second lock on the platform-admin routes, layered on top of the global
 * InternalKeyGuard. Those routes are the only ones that read and delete ACROSS
 * tenants (raw PrismaService, no tenant extension), and a company delete
 * cascades to every row that company owns — so they must not be reachable with
 * the internal key alone, which is shared widely with the BFF, seeds and e2e.
 * PLATFORM_ADMIN_KEY is a separate secret held only by the admin console.
 *
 * Fails closed: an unset/empty PLATFORM_ADMIN_KEY rejects every request rather
 * than degrading to "no check", so a missing env var can never silently open
 * cross-tenant deletes.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const expected = process.env.PLATFORM_ADMIN_KEY;
    if (!expected) throw new UnauthorizedException('platform admin key not configured');

    const req = ctx.switchToHttp().getRequest<AdminRequest>();
    const provided = req.headers['x-platform-admin-key'];
    if (typeof provided !== 'string') throw new UnauthorizedException('missing platform admin key');

    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('invalid platform admin key');
    }
    return true;
  }
}
