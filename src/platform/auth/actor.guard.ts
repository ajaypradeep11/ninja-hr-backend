// src/platform/auth/actor.guard.ts
// Resolves the caller into a full ActorContext on the request. Runs after
// InternalKeyGuard (the edge guard), which sets either `req.trusted` (internal
// key / BFF lane) or `req.firebaseUser` (verified end-user bearer lane).
//
// Trusted lane: legacy behavior, byte-for-byte — x-actor-id header (no role
// check; the BFF is trusted) with a persona-based fallback when absent.
//
// Firebase lane: the caller is resolved by firebaseUid (falling back to an
// email join against Employee, which stamps firebaseUid on first match) and
// must be provisioned. x-actor-id impersonation on this lane is honored only
// when the verified caller is HR_ADMIN; realUserId always carries the real,
// verified user's id so impersonation is traceable even while userId reflects
// the impersonated target.
import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../database/prisma.service';
import { TenantContext } from '../database/tenant-context';
import { IS_PUBLIC } from './public.decorator';
import type { ActorContext, ActorRole } from './actor-context';
import type { VerifiedFirebaseUser } from './firebase-admin.service';

interface ActorRequest {
  headers: Record<string, string | undefined>;
  actor?: ActorContext;
  trusted?: boolean;
  firebaseUser?: VerifiedFirebaseUser;
}

@Injectable()
export class ActorGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
    private readonly tenant: TenantContext,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    // @Public() routes (health, company bootstrap) carry no credentials, so
    // InternalKeyGuard lets them through without setting req.trusted /
    // req.firebaseUser. They need no actor — skip resolution rather than hit the
    // fail-closed throw below.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<ActorRequest>();

    if (req.firebaseUser) {
      const { uid, email, emailVerified } = req.firebaseUser;
      let user = await this.prisma.user.findUnique({ where: { firebaseUid: uid }, include: { employee: true } });
      // First-login account linking by email is only safe for a VERIFIED email.
      // Otherwise an attacker could self-register a Firebase account using an
      // existing employee's address (Firebase leaves it unverified) and, on the
      // first API call, get their uid permanently bound to that employee's
      // account — full takeover, including HR_ADMIN. Requiring email_verified
      // closes that path while still auto-linking legitimately invited users.
      if (!user && email && emailVerified) {
        user = await this.prisma.user.findFirst({ where: { employee: { email } }, include: { employee: true } });
        if (user) {
          await this.prisma.user.update({ where: { id: user.id }, data: { firebaseUid: uid } });
        }
      }
      if (!user) throw new ForbiddenException('account not provisioned — contact HR');

      let acting = user;
      const targetId = req.headers['x-actor-id'];
      if (user.role === 'HR_ADMIN' && typeof targetId === 'string' && targetId.length > 0 && targetId !== user.id) {
        const target = await this.prisma.user.findUnique({ where: { id: targetId }, include: { employee: true } });
        if (!target) throw new UnauthorizedException('unknown impersonation target');
        // Impersonation is strictly intra-tenant: an HR_ADMIN may only act as a
        // user in their own company. Crossing tenants here would be a direct
        // data-isolation breach (the ALS tenant below follows the target).
        if (target.companyId !== user.companyId) {
          throw new ForbiddenException('cannot impersonate a user in another company');
        }
        acting = target;
      }
      req.actor = {
        userId: acting.id,
        employeeId: acting.employeeId,
        employeeName: acting.employee.name,
        department: acting.employee.department,
        role: acting.role as ActorRole,
        realUserId: user.id,
        companyId: acting.companyId,
      };
      this.tenant.set(acting.companyId);
      return true;
    }

    // Trusted lane (internal key). Explicitly require req.trusted — set only by
    // InternalKeyGuard after a constant-time key match — so the client-supplied
    // x-actor-id / x-actor-persona headers below are honored ONLY for the
    // trusted BFF, never for an unauthenticated caller. (InternalKeyGuard runs
    // first and already rejects requests with neither lane, but gating here as
    // well fails closed if that ordering ever regresses.)
    if (req.trusted) {
      const actorId = req.headers['x-actor-id'];

      if (typeof actorId === 'string' && actorId.length > 0) {
        const user = await this.prisma.user.findUnique({
          where: { id: actorId },
          include: { employee: true },
        });
        if (!user) throw new UnauthorizedException('unknown actor');
        req.actor = {
          userId: user.id,
          employeeId: user.employeeId,
          employeeName: user.employee.name,
          department: user.employee.department,
          role: user.role as ActorRole,
          realUserId: user.id,
          companyId: user.companyId,
        };
        this.tenant.set(user.companyId);
        return true;
      }

      // Legacy fallback — no user identity, coarse persona only. A trusted
      // caller (internal key already verified) MAY name the tenant explicitly
      // via x-company-id; this is the server-to-server / seed / e2e path (the
      // production BFF uses the Firebase lane or x-actor-id, both of which carry
      // their own company). Without it there is NO tenant and scoped queries
      // fail closed — the tenant-less public flows resolve their company via
      // slug/token in runInTenant instead.
      const persona = req.headers['x-actor-persona'];
      const explicitCompany = req.headers['x-company-id'];
      const companyId = typeof explicitCompany === 'string' && explicitCompany.length > 0 ? explicitCompany : null;
      req.actor = {
        userId: null,
        employeeId: null,
        employeeName: null,
        department: null,
        role: persona === 'admin' ? 'HR_ADMIN' : 'EMPLOYEE',
        realUserId: null,
        companyId,
      };
      if (companyId) this.tenant.set(companyId);
      return true;
    }

    throw new UnauthorizedException('unauthenticated');
  }
}
