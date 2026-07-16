import { Injectable, Logger } from '@nestjs/common';
import type { ActorContext } from 'src/platform/auth/actor-context';
import type { Persona } from 'src/platform/auth/actor.decorator';
import { TenantPrismaService } from 'src/platform/database/tenant-prisma.service';
import type { AgentSnapshot } from '../domain/chat.types';

const iso = (date: Date) => date.toISOString().slice(0, 10);

@Injectable()
export class SnapshotService {
  private readonly logger = new Logger(SnapshotService.name);

  constructor(private readonly prisma: TenantPrismaService) {}

  async build(persona: Persona, actor?: ActorContext): Promise<AgentSnapshot> {
    try {
      if (persona !== 'admin') {
        if (!actor?.employeeId) {
          return { json: '{"note":"no employee record linked to this account"}', otherEmployeeNames: [] };
        }
        const [me, leave, otherEmployees] = await Promise.all([
          this.prisma.employee.findUnique({
            where: { id: actor.employeeId },
            select: { name: true, title: true, department: true, province: true, hireDate: true, status: true },
          }),
          this.prisma.leaveRequest.findMany({
            where: { employeeId: actor.employeeId },
            select: { type: true, status: true, start: true, end: true, days: true },
            orderBy: { start: 'desc' },
            take: 25,
          }),
          this.prisma.employee.findMany({
            where: { id: { not: actor.employeeId } },
            select: { name: true },
            orderBy: { name: 'asc' },
            take: 500,
          }),
        ]);
        return {
          json: JSON.stringify({
            me: me && { ...me, hireDate: iso(me.hireDate) },
            myLeave: leave.map((item) => ({ ...item, start: iso(item.start), end: iso(item.end) })),
          }),
          otherEmployeeNames: otherEmployees.map((employee) => employee.name),
        };
      }

      const [settings, employees, leave, requisitions, cases] = await Promise.all([
        this.prisma.companySettings.findFirst({ select: { companyName: true, provinces: true } }),
        this.prisma.employee.findMany({
          select: { name: true, title: true, department: true, province: true, hireDate: true, status: true },
          orderBy: { name: 'asc' },
          take: 100,
        }),
        this.prisma.leaveRequest.findMany({
          select: { type: true, status: true, start: true, end: true, days: true, employee: { select: { name: true } } },
          orderBy: { start: 'desc' },
          take: 200,
        }),
        this.prisma.requisition.findMany({
          select: { title: true, province: true, status: true, salaryMin: true, salaryMax: true },
          take: 50,
        }),
        this.prisma.onboardingCase.findMany({ select: { name: true, status: true, startDate: true }, take: 50 }),
      ]);
      return {
        json: JSON.stringify({
          company: settings,
          employees: employees.map((employee) => ({ ...employee, hireDate: iso(employee.hireDate) })),
          leaveRequests: leave.map((item) => ({
            employee: item.employee.name,
            type: item.type,
            status: item.status,
            start: iso(item.start),
            end: iso(item.end),
            days: item.days,
          })),
          requisitions,
          onboardingCases: cases.map((item) => ({ ...item, startDate: iso(item.startDate) })),
        }),
        otherEmployeeNames: [],
      };
    } catch (error) {
      this.logger.warn(`agent snapshot failed: ${error instanceof Error ? error.message : String(error)}`);
      return { json: '{"note":"live data snapshot unavailable"}', otherEmployeeNames: [] };
    }
  }
}
