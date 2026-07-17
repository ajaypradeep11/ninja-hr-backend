// src/platform/auth/app-throttler.guard.ts
// Per-IP rate limiting for the untrusted lanes (public routes, Firebase
// bearer callers, and anonymous probing of the Cloud Run URL).
//
// The trusted internal-key lane is exempt: every end-user request proxied by
// the frontend BFF arrives from the BFF's egress IP, so throttling that lane
// per-IP would pool every legitimate user into a single bucket. The key is
// already a full-trust credential — a caller who has it does not need to be
// rate-limited to be kept honest. InternalKeyGuard runs first (APP_GUARD
// order) and sets req.trusted, including on @Public routes when the key is
// presented.
//
// NOTE: storage is in-memory, so on Cloud Run the effective limit is
// (instances × limit) and resets on restart. That is acceptable for an abuse
// cap; it is not a precise quota.
import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected shouldSkip(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<{ trusted?: boolean }>();
    return Promise.resolve(req.trusted === true);
  }
}
