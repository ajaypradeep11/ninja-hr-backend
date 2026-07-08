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
import { PrismaService } from '../database/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<ActorRequest>();

    if (req.firebaseUser) {
      const { uid, email } = req.firebaseUser;
      let user = await this.prisma.user.findUnique({ where: { firebaseUid: uid }, include: { employee: true } });
      if (!user && email) {
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
        acting = target;
      }
      req.actor = {
        userId: acting.id,
        employeeId: acting.employeeId,
        employeeName: acting.employee.name,
        department: acting.employee.department,
        role: acting.role as ActorRole,
        realUserId: user.id,
      };
      return true;
    }

    // Trusted lane (internal key) — unchanged legacy behavior.
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
      };
      return true;
    }

    // Legacy fallback — no user identity, coarse persona only.
    const persona = req.headers['x-actor-persona'];
    req.actor = {
      userId: null,
      employeeId: null,
      employeeName: null,
      department: null,
      role: persona === 'admin' ? 'HR_ADMIN' : 'EMPLOYEE',
      realUserId: null,
    };
    return true;
  }
}
