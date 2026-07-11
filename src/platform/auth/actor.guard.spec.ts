// src/platform/auth/actor.guard.spec.ts
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ActorGuard } from './actor.guard';

const HR = {
  id: 'hr1',
  employeeId: 'e-hr',
  role: 'HR_ADMIN',
  firebaseUid: 'fb-hr',
  companyId: 'c1',
  employee: { name: 'Sarah', department: 'HR', email: 'sarah@x.ca' },
};
const EMP = {
  id: 'emp1',
  employeeId: 'e-emp',
  role: 'EMPLOYEE',
  firebaseUid: null,
  companyId: 'c1',
  employee: { name: 'Maya', department: 'Dev', email: 'maya@x.ca' },
};
// A user in a DIFFERENT company — used to prove cross-tenant impersonation is denied.
const OTHER = {
  id: 'emp2',
  employeeId: 'e-emp2',
  role: 'EMPLOYEE',
  firebaseUid: null,
  companyId: 'c2',
  employee: { name: 'Bob', department: 'Ops', email: 'bob@y.ca' },
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
// Fake TenantContext: captures the companyId the guard sets so tests can assert it.
function makeTenant() {
  return { companyId: undefined as string | null | undefined, set(id: string | null) { this.companyId = id; } };
}
// Reflector stub: routes are non-public unless a test uses publicReflector.
const notPublic = { getAllAndOverride: () => false } as never;
const publicReflector = { getAllAndOverride: () => true } as never;
const ctxFor = (req: Record<string, unknown>) =>
  ({ switchToHttp: () => ({ getRequest: () => req }), getHandler: () => undefined, getClass: () => undefined }) as never;

describe('ActorGuard firebase lane', () => {
  it('resolves by firebaseUid and sets the tenant', async () => {
    const req: Record<string, unknown> = { headers: {}, firebaseUser: { uid: 'fb-hr', email: 'sarah@x.ca' } };
    const tenant = makeTenant();
    await new ActorGuard(makePrisma([HR]) as never, notPublic, tenant as never).canActivate(ctxFor(req));
    expect((req.actor as never)['userId']).toBe('hr1');
    expect((req.actor as never)['realUserId']).toBe('hr1');
    expect((req.actor as never)['companyId']).toBe('c1');
    expect(tenant.companyId).toBe('c1');
  });

  it('falls back to email match and stamps the uid (verified email only)', async () => {
    const prisma = makePrisma([{ ...EMP }]);
    const req: Record<string, unknown> = {
      headers: {},
      firebaseUser: { uid: 'fb-new', email: 'maya@x.ca', emailVerified: true },
    };
    await new ActorGuard(prisma as never, notPublic, makeTenant() as never).canActivate(ctxFor(req));
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { firebaseUid: 'fb-new' } }));
    expect((req.actor as never)['userId']).toBe('emp1');
  });

  it('does NOT link by email when the email is unverified (account-takeover guard)', async () => {
    const prisma = makePrisma([{ ...EMP }]);
    const req: Record<string, unknown> = {
      headers: {},
      firebaseUser: { uid: 'fb-attacker', email: 'maya@x.ca', emailVerified: false },
    };
    await expect(
      new ActorGuard(prisma as never, notPublic, makeTenant() as never).canActivate(ctxFor(req)),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('403s an unprovisioned firebase user', async () => {
    const req = { headers: {}, firebaseUser: { uid: 'ghost', email: 'ghost@x.ca', emailVerified: true } };
    await expect(
      new ActorGuard(makePrisma([HR]) as never, notPublic, makeTenant() as never).canActivate(ctxFor(req)),
    ).rejects.toThrow(ForbiddenException);
  });

  it('lets HR impersonate a same-company user via x-actor-id, keeping realUserId + tenant', async () => {
    const req: Record<string, unknown> = {
      headers: { 'x-actor-id': 'emp1' },
      firebaseUser: { uid: 'fb-hr', email: 'sarah@x.ca' },
    };
    const tenant = makeTenant();
    await new ActorGuard(makePrisma([HR, EMP]) as never, notPublic, tenant as never).canActivate(ctxFor(req));
    expect((req.actor as never)['userId']).toBe('emp1');
    expect((req.actor as never)['realUserId']).toBe('hr1');
    expect((req.actor as never)['companyId']).toBe('c1');
    expect(tenant.companyId).toBe('c1');
  });

  it('DENIES cross-company impersonation (tenant isolation)', async () => {
    const req: Record<string, unknown> = {
      headers: { 'x-actor-id': 'emp2' },
      firebaseUser: { uid: 'fb-hr', email: 'sarah@x.ca' },
    };
    await expect(
      new ActorGuard(makePrisma([HR, OTHER]) as never, notPublic, makeTenant() as never).canActivate(ctxFor(req)),
    ).rejects.toThrow(ForbiddenException);
  });

  it('ignores x-actor-id for non-admin firebase users', async () => {
    const req: Record<string, unknown> = {
      headers: { 'x-actor-id': 'hr1' },
      firebaseUser: { uid: 'fb-new', email: 'maya@x.ca', emailVerified: true },
    };
    await new ActorGuard(makePrisma([HR, { ...EMP }]) as never, notPublic, makeTenant() as never).canActivate(
      ctxFor(req),
    );
    expect((req.actor as never)['userId']).toBe('emp1');
  });
});

describe('ActorGuard trusted lane', () => {
  it('resolves the actor by x-actor-id, mirrors realUserId, and sets the tenant', async () => {
    const req: Record<string, unknown> = { headers: { 'x-actor-id': 'hr1' }, trusted: true };
    const tenant = makeTenant();
    await new ActorGuard(makePrisma([HR]) as never, notPublic, tenant as never).canActivate(ctxFor(req));
    expect((req.actor as never)['userId']).toBe('hr1');
    expect((req.actor as never)['realUserId']).toBe('hr1');
    expect((req.actor as never)['role']).toBe('HR_ADMIN');
    expect((req.actor as never)['companyId']).toBe('c1');
    expect(tenant.companyId).toBe('c1');
  });

  it('throws UnauthorizedException for an unknown x-actor-id', async () => {
    const req: Record<string, unknown> = { headers: { 'x-actor-id': 'nope' }, trusted: true };
    await expect(
      new ActorGuard(makePrisma([HR]) as never, notPublic, makeTenant() as never).canActivate(ctxFor(req)),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('persona fallback honors an explicit x-company-id tenant hint', async () => {
    const req: Record<string, unknown> = {
      headers: { 'x-actor-persona': 'admin', 'x-company-id': 'c-seed' },
      trusted: true,
    };
    const tenant = makeTenant();
    await new ActorGuard(makePrisma([]) as never, notPublic, tenant as never).canActivate(ctxFor(req));
    expect((req.actor as never)['companyId']).toBe('c-seed');
    expect(tenant.companyId).toBe('c-seed');
  });

  it('persona fallback carries NO tenant (tenant-scoped queries fail closed)', async () => {
    const req: Record<string, unknown> = { headers: { 'x-actor-persona': 'admin' }, trusted: true };
    const tenant = makeTenant();
    await new ActorGuard(makePrisma([]) as never, notPublic, tenant as never).canActivate(ctxFor(req));
    expect((req.actor as never)['userId']).toBeNull();
    expect((req.actor as never)['realUserId']).toBeNull();
    expect((req.actor as never)['role']).toBe('HR_ADMIN');
    expect((req.actor as never)['companyId']).toBeNull();
    // Never set a tenant on the persona lane — it must stay unresolved.
    expect(tenant.companyId).toBeUndefined();
  });

  it('defaults persona to EMPLOYEE when absent', async () => {
    const req: Record<string, unknown> = { headers: {}, trusted: true };
    await new ActorGuard(makePrisma([]) as never, notPublic, makeTenant() as never).canActivate(ctxFor(req));
    expect((req.actor as never)['role']).toBe('EMPLOYEE');
  });
});

describe('ActorGuard public + fail-closed', () => {
  it('allows @Public routes with no credentials and resolves no actor', async () => {
    const req: Record<string, unknown> = { headers: {} };
    const ok = await new ActorGuard(makePrisma([]) as never, publicReflector, makeTenant() as never).canActivate(
      ctxFor(req),
    );
    expect(ok).toBe(true);
    expect(req.actor).toBeUndefined();
  });

  it('fails closed when the request is neither trusted, firebase, nor public', async () => {
    const req: Record<string, unknown> = { headers: { 'x-actor-persona': 'admin' } };
    await expect(
      new ActorGuard(makePrisma([]) as never, notPublic, makeTenant() as never).canActivate(ctxFor(req)),
    ).rejects.toThrow(UnauthorizedException);
  });
});
