import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'node:crypto';
import { IS_PUBLIC } from './public.decorator';
import { FirebaseAdminService, VerifiedFirebaseUser } from './firebase-admin.service';

interface EdgeRequest {
  headers: Record<string, string | undefined>;
  trusted?: boolean;
  firebaseUser?: VerifiedFirebaseUser;
}

@Injectable()
export class InternalKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly firebase: FirebaseAdminService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<EdgeRequest>();

    // Lane 1 — trusted server-to-server (BFF, seeds, e2e): constant-time key check.
    const expected = process.env.INTERNAL_API_KEY;
    const provided = req.headers['x-internal-key'];
    if (typeof provided === 'string' && expected) {
      const a = Buffer.from(provided);
      const b = Buffer.from(expected);
      if (a.length === b.length && timingSafeEqual(a, b)) {
        req.trusted = true;
        return true;
      }
    }

    // Lane 2 — end-user requests: Firebase bearer token / session cookie.
    const authz = req.headers['authorization'];
    if (authz?.startsWith('Bearer ')) {
      req.firebaseUser = await this.firebase.verifyBearer(authz.slice(7));
      return true;
    }

    throw new UnauthorizedException('missing credentials');
  }
}
