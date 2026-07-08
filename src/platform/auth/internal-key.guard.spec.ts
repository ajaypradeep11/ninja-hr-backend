import { UnauthorizedException } from '@nestjs/common';
import { InternalKeyGuard } from './internal-key.guard';

function ctxWith(headers: Record<string, string>, req: Record<string, unknown> = {}) {
  Object.assign(req, { headers });
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => req }),
  } as never;
}
const reflectorPass = { getAllAndOverride: () => false } as never;
const reflectorPublic = { getAllAndOverride: () => true } as never;

describe('InternalKeyGuard', () => {
  const originalKey = process.env.INTERNAL_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.INTERNAL_API_KEY;
    else process.env.INTERNAL_API_KEY = originalKey;
  });

  it('lets @Public() routes through without any credentials', async () => {
    delete process.env.INTERNAL_API_KEY;
    const guard = new InternalKeyGuard(reflectorPublic, { enabled: false } as never);
    await expect(guard.canActivate(ctxWith({}))).resolves.toBe(true);
  });

  it('rejects when no internal key, no bearer token, and not public', async () => {
    process.env.INTERNAL_API_KEY = 'k';
    const guard = new InternalKeyGuard(reflectorPass, { enabled: false } as never);
    await expect(guard.canActivate(ctxWith({}))).rejects.toThrow(UnauthorizedException);
  });
});

describe('InternalKeyGuard bearer lane', () => {
  it('verifies bearer tokens and attaches firebaseUser', async () => {
    const fb = { enabled: true, verifyBearer: jest.fn().mockResolvedValue({ uid: 'u1', email: 'a@b.c' }) };
    const guard = new InternalKeyGuard(reflectorPass, fb as never);
    const req: Record<string, unknown> = {};
    await expect(guard.canActivate(ctxWith({ authorization: 'Bearer tok' }, req))).resolves.toBe(true);
    expect(req.firebaseUser).toEqual({ uid: 'u1', email: 'a@b.c' });
  });

  it('rejects garbage bearer', async () => {
    const fb = { enabled: true, verifyBearer: jest.fn().mockRejectedValue(new UnauthorizedException()) };
    const guard = new InternalKeyGuard(reflectorPass, fb as never);
    await expect(guard.canActivate(ctxWith({ authorization: 'Bearer bad' }))).rejects.toThrow(UnauthorizedException);
  });

  it('marks internal-key requests trusted', async () => {
    process.env.INTERNAL_API_KEY = 'k';
    const guard = new InternalKeyGuard(reflectorPass, { enabled: false } as never);
    const req: Record<string, unknown> = {};
    await expect(guard.canActivate(ctxWith({ 'x-internal-key': 'k' }, req))).resolves.toBe(true);
    expect(req.trusted).toBe(true);
  });
});
