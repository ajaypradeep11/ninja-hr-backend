// src/contexts/timeoff/infrastructure/timeoff.repository.ts
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/platform/database/prisma.service';
import type { ActorContext } from 'src/platform/auth/actor-context';
import type { LeaveRequest, LeaveStatus, LeaveType } from '../domain/timeoff.types';
import { leaveStatusToDb, leaveTypeToDb, rowToLeaveRequest } from './timeoff.mapper';

export interface CreateLeaveInput {
  employeeName: string;
  type: LeaveType;
  start: string;
  end: string;
  days: number;
  /** Partial-day request: hours on `start` (1–7). Omit for full day(s). */
  hours?: number;
}

export interface UpdateLeaveInput {
  type?: LeaveType;
  start?: string;
  end?: string;
  days?: number;
  /** Pass null to convert a partial-day record back to full day(s). */
  hours?: number | null;
  status?: LeaveStatus;
}

@Injectable()
export class TimeoffRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Actor-scoped list — this IS the routing:
   *  - HR_ADMIN sees the company-wide absence log,
   *  - a MANAGER sees their own requests + every request from their department
   *    (their approval queue),
   *  - an employee sees only their own.
   */
  async getLeaveRequests(actor?: ActorContext): Promise<LeaveRequest[]> {
    const where =
      !actor || actor.role === 'HR_ADMIN'
        ? {}
        : actor.role === 'MANAGER' && actor.department
          ? { OR: [{ employee: { department: actor.department } }, { employeeId: actor.employeeId ?? '__none__' }] }
          : { employeeId: actor?.employeeId ?? '__none__' };
    const rows = await this.prisma.leaveRequest.findMany({
      where,
      include: { employee: true },
      orderBy: { start: 'asc' },
    });
    return rows.map(rowToLeaveRequest);
  }

  /**
   * Approve/deny — routed to the employee's DEPARTMENT MANAGER. HR keeps an
   * override path via the absence log, but the day-to-day decision belongs to
   * the manager of that department.
   */
  async updateStatus(id: string, status: LeaveStatus, actor: ActorContext): Promise<void> {
    const row = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: { employee: { select: { department: true } } },
    });
    if (!row) throw new NotFoundException('Leave request not found');

    const isDeptManager =
      actor.role === 'MANAGER' && !!actor.department && actor.department === row.employee.department;
    if (actor.role !== 'HR_ADMIN' && !isDeptManager) {
      throw new ForbiddenException(
        `This request is routed to the ${row.employee.department} department manager for approval`,
      );
    }
    await this.prisma.leaveRequest.update({
      where: { id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { status: leaveStatusToDb[status] as any },
    });
  }

  /** HR-only absence-record override: adjust dates, type, duration or status. */
  async updateLeave(id: string, input: UpdateLeaveInput, actor: ActorContext): Promise<void> {
    const row = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: { employee: { select: { id: true } } },
    });
    if (!row) throw new NotFoundException('Leave request not found');

    // Tiered permissions: HR edits anything; an employee may edit their OWN
    // request while it's still Pending (and cannot change its status).
    if (actor.role !== 'HR_ADMIN') {
      const isOwner = !!actor.employeeId && row.employeeId === actor.employeeId;
      if (!isOwner) throw new ForbiddenException('You can only edit your own requests');
      if (row.status !== 'PENDING') {
        throw new ConflictException('Only pending requests can be edited — ask HR for changes');
      }
      if (input.status) {
        throw new ForbiddenException('Request status is decided by your department manager');
      }
    }

    const start = input.start ? new Date(input.start) : row.start;
    const end = input.end ? new Date(input.end) : row.end;
    if (end.getTime() < start.getTime()) {
      throw new BadRequestException('Leave end date must not be before start date');
    }

    await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(input.type ? { type: leaveTypeToDb[input.type] as any } : {}),
        ...(input.start ? { start } : {}),
        ...(input.end ? { end } : {}),
        ...(input.days !== undefined ? { days: input.days } : {}),
        ...(input.hours !== undefined ? { hours: input.hours } : {}),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(input.status ? { status: leaveStatusToDb[input.status] as any } : {}),
      },
    });
  }

  /** Withdraw a request: the owner may cancel while Pending; HR may remove any. */
  async cancelLeave(id: string, actor: ActorContext): Promise<void> {
    const row = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Leave request not found');
    if (actor.role !== 'HR_ADMIN') {
      const isOwner = !!actor.employeeId && row.employeeId === actor.employeeId;
      if (!isOwner) throw new ForbiddenException('You can only cancel your own requests');
      if (row.status !== 'PENDING') {
        throw new ConflictException('Only pending requests can be cancelled — ask HR for changes');
      }
    }
    await this.prisma.leaveRequest.delete({ where: { id } });
  }

  async createLeave(input: CreateLeaveInput): Promise<void> {
    const start = new Date(input.start);
    const end = new Date(input.end);
    if (end.getTime() < start.getTime()) {
      throw new BadRequestException('Leave end date must not be before start date');
    }

    const isOvertime = input.type === 'Overtime';
    if (isOvertime) {
      // Overtime = extra hours worked on a single date, tracked (not deducted).
      if (input.hours == null || input.hours < 1 || input.hours > 12) {
        throw new BadRequestException('Overtime must record between 1 and 12 hours worked');
      }
      if (input.start !== input.end) {
        throw new BadRequestException('Overtime is logged against a single date');
      }
    } else if (input.hours != null) {
      // A partial-day leave request is a single calendar day, max 7h (8h = full day).
      if (input.start !== input.end) {
        throw new BadRequestException('Partial-day requests must start and end on the same date');
      }
      if (input.hours > 7) {
        throw new BadRequestException('A partial day is at most 7 hours — use full day(s) instead');
      }
    }

    const emp = await this.prisma.employee.findFirst({ where: { name: input.employeeName } });
    if (!emp) throw new NotFoundException(`Employee '${input.employeeName}' not found`);

    await this.prisma.leaveRequest.create({
      data: {
        employeeId: emp.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type: leaveTypeToDb[input.type] as any,
        start: new Date(input.start),
        end: new Date(input.end),
        status: 'PENDING',
        // Overtime is a single-date entry regardless of the days sent.
        days: isOvertime ? 1 : input.days,
        hours: input.hours ?? null,
      },
    });
  }
}
