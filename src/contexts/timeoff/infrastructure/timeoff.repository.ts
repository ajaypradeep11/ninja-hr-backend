// src/contexts/timeoff/infrastructure/timeoff.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/platform/database/prisma.service';
import type { LeaveRequest, LeaveStatus, LeaveType } from '../domain/timeoff.types';
import { leaveStatusToDb, leaveTypeToDb, rowToLeaveRequest } from './timeoff.mapper';

export interface CreateLeaveInput {
  employeeName: string;
  type: LeaveType;
  start: string;
  end: string;
  days: number;
}

@Injectable()
export class TimeoffRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getLeaveRequests(): Promise<LeaveRequest[]> {
    const rows = await this.prisma.leaveRequest.findMany({
      include: { employee: true },
      orderBy: { start: 'asc' },
    });
    return rows.map(rowToLeaveRequest);
  }

  async updateStatus(id: string, status: LeaveStatus): Promise<void> {
    await this.prisma.leaveRequest.update({
      where: { id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { status: leaveStatusToDb[status] as any },
    });
  }

  async createLeave(input: CreateLeaveInput): Promise<void> {
    const emp = await this.prisma.employee.findFirst({ where: { name: input.employeeName } });
    if (!emp) return;

    await this.prisma.leaveRequest.create({
      data: {
        employeeId: emp.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type: leaveTypeToDb[input.type] as any,
        start: new Date(input.start),
        end: new Date(input.end),
        status: 'PENDING',
        days: input.days,
      },
    });
  }
}
