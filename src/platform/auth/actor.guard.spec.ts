// src/platform/auth/actor.guard.spec.ts
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ActorGuard } from './actor.guard';

const HR = {
  id: 'hr1',
  employeeId: 'e-hr',
  role: 'HR_ADMIN',
  firebaseUid: 'fb-hr',
  employee: { name: 'Sarah', department: 'HR', email: 'sarah@x.ca' },
};
const EMP = {
  id: 'emp1',
  employeeId: 'e-emp',
  role: 'EMPLOYEE',
  firebaseUid: null,
  employee: { name: 'Maya', department: 'Dev', email: 'maya@x.ca' },
};

function makePrisma(users: unknown[]) {
  return {
    user: {
      findUnique: jest.fn(async ({ where }: any) =>
        users.find(
          (u: any) => (where.firebaseUid && u.firebaseUid === where.firebaseUid) || (where.id && u.id === where.id),
        ) ?? null,
      ),
      findFirst: jest.fn(
        async ({ where }: any) => users.find((u: any) => u.employee.email === where.employee.email) ?? null,
      ),
      update: jest.fn(async ({ where, data }: any) => {
        const u = users.find((x: any) => x.id === where.id) as any;
        Object.assign(u, data);
        return u;
      }),
    },
  };
}
const ctxFor = (req: Record<string, unknown>) => ({ switchToHttp: () => ({ getRequest: () => req }) }) as never;

describe('ActorGuard firebase lane', () => {
  it('resolves by firebaseUid', async () => {
    const req: Record<string, unknown> = { headers: {}, firebaseUser: { uid: 'fb-hr', email: 'sarah@x.ca' } };
    await new ActorGuard(makePrisma([HR]) as never).canActivate(ctxFor(req));
    expect((req.actor as never)['userId']).toBe('hr1');
    expect((req.actor as never)['realUserId']).toBe('hr1');
  });

  it('falls back to email match and stamps the uid (verified email only)', async () => {
    const prisma = makePrisma([{ ...EMP }]);
    const req: Record<string, unknown> = {
      headers: {},
      firebaseUser: { uid: 'fb-new', email: 'maya@x.ca', emailVerified: true },
    };
    await new ActorGuard(prisma as never).canActivate(ctxFor(req));
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { firebaseUid: 'fb-new' } }));
    expect((req.actor as never)['userId']).toBe('emp1');
  });

  it('does NOT link by email when the email is unverified (account-takeover guard)', async () => {
    const prisma = makePrisma([{ ...EMP }]);
    const req: Record<string, unknown> = {
      headers: {},
      firebaseUser: { uid: 'fb-attacker', email: 'maya@x.ca', emailVerified: false },
    };
    await expect(new ActorGuard(prisma as never).canActivate(ctxFor(req))).rejects.toThrow(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('403s an unprovisioned firebase user', async () => {
    const req = { headers: {}, firebaseUser: { uid: 'ghost', email: 'ghost@x.ca', emailVerified: true } };
    await expect(new ActorGuard(makePrisma([HR]) as never).canActivate(ctxFor(req))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('lets HR impersonate via x-actor-id, keeping realUserId', async () => {
    const req: Record<string, unknown> = {
      headers: { 'x-actor-id': 'emp1' },
      firebaseUser: { uid: 'fb-hr', email: 'sarah@x.ca' },
    };
    await new ActorGuard(makePrisma([HR, EMP]) as never).canActivate(ctxFor(req));
    expect((req.actor as never)['userId']).toBe('emp1');
    expect((req.actor as never)['realUserId']).toBe('hr1');
  });

  it('ignores x-actor-id for non-admin firebase users', async () => {
    const req: Record<string, unknown> = {
      headers: { 'x-actor-id': 'hr1' },
      firebaseUser: { uid: 'fb-new', email: 'maya@x.ca', emailVerified: true },
    };
    await new ActorGuard(makePrisma([HR, { ...EMP }]) as never).canActivate(ctxFor(req));
    expect((req.actor as never)['userId']).toBe('emp1');
  });
});

describe('ActorGuard trusted lane (legacy, unchanged)', () => {
  it('resolves the actor by x-actor-id and mirrors realUserId', async () => {
    const req: Record<string, unknown> = { headers: { 'x-actor-id': 'hr1' }, trusted: true };
    await new ActorGuard(makePrisma([HR]) as never).canActivate(ctxFor(req));
    expect((req.actor as never)['userId']).toBe('hr1');
    expect((req.actor as never)['realUserId']).toBe('hr1');
    expect((req.actor as never)['role']).toBe('HR_ADMIN');
  });

  it('throws UnauthorizedException for an unknown x-actor-id', async () => {
    const req: Record<string, unknown> = { headers: { 'x-actor-id': 'nope' }, trusted: true };
    await expect(new ActorGuard(makePrisma([HR]) as never).canActivate(ctxFor(req))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('falls back to persona when no x-actor-id is present', async () => {
    const req: Record<string, unknown> = { headers: { 'x-actor-persona': 'admin' }, trusted: true };
    await new ActorGuard(makePrisma([]) as never).canActivate(ctxFor(req));
    expect((req.actor as never)['userId']).toBeNull();
    expect((req.actor as never)['realUserId']).toBeNull();
    expect((req.actor as never)['role']).toBe('HR_ADMIN');
  });

  it('defaults persona to EMPLOYEE when absent', async () => {
    const req: Record<string, unknown> = { headers: {}, trusted: true };
    await new ActorGuard(makePrisma([]) as never).canActivate(ctxFor(req));
    expect((req.actor as never)['role']).toBe('EMPLOYEE');
  });
});
