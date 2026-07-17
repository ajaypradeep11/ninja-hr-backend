// src/platform/auth/app-throttler.guard.spec.ts
import { ExecutionContext } from '@nestjs/common';
import { AppThrottlerGuard } from './app-throttler.guard';

const ctxFor = (req: Record<string, unknown>) =>
  ({ switchToHttp: () => ({ getRequest: () => req }) }) as unknown as ExecutionContext;

// shouldSkip is protected; reach it via a subclass so the contract stays typed.
class TestableGuard extends AppThrottlerGuard {
  skips(ctx: ExecutionContext): Promise<boolean> {
    return this.shouldSkip(ctx);
  }
}

// The guard's own dependencies (options/storage/reflector) are unused by
// shouldSkip — construct without them.
const guard = new (TestableGuard as unknown as new () => TestableGuard)();

describe('AppThrottlerGuard.shouldSkip', () => {
  it('exempts the trusted internal-key lane (BFF egress IP would pool all users)', async () => {
    await expect(guard.skips(ctxFor({ trusted: true }))).resolves.toBe(true);
  });

  it('throttles firebase-lane requests', async () => {
    await expect(guard.skips(ctxFor({ firebaseUser: { uid: 'u1' } }))).resolves.toBe(false);
  });

  it('throttles anonymous/public requests', async () => {
    await expect(guard.skips(ctxFor({}))).resolves.toBe(false);
  });

  it('does not honor a client-forgeable truthy-but-not-true trusted value', async () => {
    await expect(guard.skips(ctxFor({ trusted: 'yes' }))).resolves.toBe(false);
  });
});
