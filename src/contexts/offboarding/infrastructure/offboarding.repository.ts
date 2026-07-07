// src/contexts/offboarding/infrastructure/offboarding.repository.ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/platform/database/prisma.service';
import type { OffboardingOwner, OffboardingStatus, OffboardingTask } from '../domain/offboarding.types';
import { ownerToDb, statusToDb, rowToTask } from './offboarding.mapper';

@Injectable()
export class OffboardingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getTasks(): Promise<OffboardingTask[]> {
    const rows = await this.prisma.offboardingTask.findMany();
    return rows.map(rowToTask);
  }

  async setTaskStatus(id: string, status: OffboardingStatus): Promise<OffboardingTask[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.prisma.offboardingTask.update({ where: { id }, data: { status: statusToDb[status] as any } });
    return this.getTasks();
  }

  /** Delegate a whole department's tasks to an internal owner (HR routing).
   *  Passing null clears the assignment. */
  async setDepartmentAssignee(
    owner: OffboardingOwner,
    assignee: string | null,
  ): Promise<OffboardingTask[]> {
    await this.prisma.offboardingTask.updateMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where: { owner: ownerToDb[owner] as any },
      data: { assignee: assignee?.trim() || null },
    });
    return this.getTasks();
  }

  async finalizeTermination(employeeName: string, override = false): Promise<void> {
    // Blocking tasks (final pay, equipment return, …) must be complete first,
    // unless a super-admin explicitly overrides the gate.
    const openBlocking = override
      ? []
      : await this.prisma.offboardingTask.findMany({
          where: { blocking: true, status: { not: 'COMPLETED' } },
          select: { label: true },
        });
    if (openBlocking.length > 0) {
      throw new ConflictException(
        `Cannot finalize termination — blocking offboarding tasks incomplete: ${openBlocking.map((t) => t.label).join('; ')}`,
      );
    }

    // Name is not unique — refuse ambiguity and report a miss instead of
    // silently terminating the wrong (or no) employee.
    const matches = await this.prisma.employee.findMany({ where: { name: employeeName }, select: { id: true } });
    if (matches.length === 0) throw new NotFoundException(`Employee '${employeeName}' not found`);
    if (matches.length > 1) {
      throw new ConflictException(`Multiple employees named '${employeeName}' — terminate by unique identifier`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.prisma.employee.update({ where: { id: matches[0].id }, data: { status: 'TERMINATED' as any } });
  }
}
