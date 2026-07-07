// src/platform/auth/actor.guard.ts
// Resolves the calling user (x-actor-id header, set by the trusted BFF) into a
// full ActorContext on the request. Runs after InternalKeyGuard.
//
// Compatibility: requests without x-actor-id fall back to the legacy
// x-actor-persona header — 'admin' maps to HR_ADMIN, anything else to
// EMPLOYEE — so pre-identity modules keep working unchanged.
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { ActorContext, ActorRole } from './actor-context';

interface ActorRequest {
  headers: Record<string, string | undefined>;
  actor?: ActorContext;
}

@Injectable()
export class ActorGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<ActorRequest>();
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
    };
    return true;
  }
}
