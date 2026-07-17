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

/**
 * INTERNAL_API_KEY accepts a comma-separated list so the key can be rotated
 * without a synchronized redeploy of every consumer: add the new key here,
 * roll the BFF/scripts over to it, then remove the old one. Order and
 * whitespace are insignificant; empty entries are ignored.
 */
export function validInternalKeys(): string[] {
  return (process.env.INTERNAL_API_KEY ?? '')
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

/** Constant-time membership check of `provided` against every valid key. */
export function matchesInternalKey(provided: string): boolean {
  const a = Buffer.from(provided);
  let matched = false;
  for (const key of validInternalKeys()) {
    const b = Buffer.from(key);
    // Check every candidate (no early exit) so timing does not reveal WHICH
    // key matched; per-candidate length gating is the same behavior as before.
    if (a.length === b.length && timingSafeEqual(a, b)) matched = true;
  }
  return matched;
}

@Injectable()
export class InternalKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly firebase: FirebaseAdminService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<EdgeRequest>();

    // Lane 1 — trusted server-to-server (BFF, seeds, e2e): constant-time key
    // check. Runs BEFORE the @Public() early-return so trusted callers are
    // marked req.trusted on public routes too — AppThrottlerGuard exempts the
    // trusted lane from per-IP throttling, and the BFF proxies every end-user
    // from one egress IP.
    const provided = req.headers['x-internal-key'];
    if (typeof provided === 'string' && matchesInternalKey(provided)) {
      req.trusted = true;
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    // Lane 2 — end-user requests: Firebase bearer token / session cookie.
    const authz = req.headers['authorization'];
    if (authz?.startsWith('Bearer ')) {
      req.firebaseUser = await this.firebase.verifyBearer(authz.slice(7));
      return true;
    }

    throw new UnauthorizedException('missing credentials');
  }
}
