import { UnauthorizedException } from '@nestjs/common';
import { PlatformAdminGuard } from './platform-admin.guard';

function ctxWith(headers: Record<string, string>) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as never;
}

describe('PlatformAdminGuard', () => {
  const originalKey = process.env.PLATFORM_ADMIN_KEY;
  const guard = new PlatformAdminGuard();

  afterEach(() => {
    if (originalKey === undefined) delete process.env.PLATFORM_ADMIN_KEY;
    else process.env.PLATFORM_ADMIN_KEY = originalKey;
  });

  it('accepts the matching key', () => {
    process.env.PLATFORM_ADMIN_KEY = 'admin-key';
    expect(guard.canActivate(ctxWith({ 'x-platform-admin-key': 'admin-key' }))).toBe(true);
  });

  it('rejects a wrong key', () => {
    process.env.PLATFORM_ADMIN_KEY = 'admin-key';
    expect(() => guard.canActivate(ctxWith({ 'x-platform-admin-key': 'nope' }))).toThrow(UnauthorizedException);
  });

  it('rejects a missing key', () => {
    process.env.PLATFORM_ADMIN_KEY = 'admin-key';
    expect(() => guard.canActivate(ctxWith({}))).toThrow(UnauthorizedException);
  });

  // Length is compared before timingSafeEqual, which throws on a length
  // mismatch rather than returning false.
  it('rejects a key of a different length without throwing a raw error', () => {
    process.env.PLATFORM_ADMIN_KEY = 'admin-key';
    expect(() => guard.canActivate(ctxWith({ 'x-platform-admin-key': 'short' }))).toThrow(UnauthorizedException);
  });

  it('fails closed when PLATFORM_ADMIN_KEY is unset, even if the caller sends one', () => {
    delete process.env.PLATFORM_ADMIN_KEY;
    expect(() => guard.canActivate(ctxWith({ 'x-platform-admin-key': 'anything' }))).toThrow(UnauthorizedException);
  });

  it('does not accept the internal key as a substitute', () => {
    process.env.PLATFORM_ADMIN_KEY = 'admin-key';
    expect(() => guard.canActivate(ctxWith({ 'x-internal-key': 'dev-internal-key' }))).toThrow(UnauthorizedException);
  });
});
