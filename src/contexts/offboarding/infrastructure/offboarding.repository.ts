// src/contexts/offboarding/infrastructure/offboarding.repository.ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from 'src/platform/database/tenant-prisma.service';
import type { OffboardingOwner, OffboardingStatus, OffboardingTask } from '../domain/offboarding.types';
import {
  findActiveStatutoryLeave,
  formatTerminationRecord,
  hasTerminationDetails,
  STATUTORY_LEAVE_LABELS,
  STATUTORY_LOCK_MARKER,
  type TerminationType,
} from '../domain/termination-guard';
import { ownerToDb, statusToDb, rowToTask } from './offboarding.mapper';

export interface FinalizeTerminationInput {
  employeeName: string;
  /** Super-admin bypass of the blocking-task gate (pre-existing flag). */
  override?: boolean;
  /** Explicit admin override of the statutory-leave termination lock. */
  statutoryOverride?: boolean;
  /** Human Rights Code certification acknowledgement — required with the override. */
  hrCertified?: boolean;
  terminationType?: TerminationType;
  reason?: string;
  rehireEligible?: boolean;
  notes?: string;
}

@Injectable()
export class OffboardingRepository {
  constructor(private readonly prisma: TenantPrismaService) {}

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

  /** Persist an initiated offboarding case: the employee is moved to the
   *  OFFBOARDING status so the separation survives page reloads. */
  async saveOffboarding(employeeName: string, template?: string): Promise<void> {
    const matches = await this.prisma.employee.findMany({
      where: { name: employeeName },
      select: { id: true, status: true },
    });
    if (matches.length === 0) throw new NotFoundException(`Employee '${employeeName}' not found`);
    if (matches.length > 1) {
      throw new ConflictException(`Multiple employees named '${employeeName}' — save by unique identifier`);
    }
    if (matches[0].status === 'TERMINATED') {
      throw new ConflictException(`'${employeeName}' is already terminated`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.prisma.employee.update({ where: { id: matches[0].id }, data: { status: 'OFFBOARDING' as any } });

    // Surface the saved case on the automation feed (same trail the
    // offboarding agent writes to) so HR has a persisted record of initiation.
    const intent = `Offboarding case saved for ${employeeName}${template ? ` (${template})` : ''}`;
    const existing = await this.prisma.agentRun.findFirst({ where: { intent } });
    if (!existing) {
      await this.prisma.agentRun.create({
        data: {
          intent,
          status: 'COMPLETED',
          progress: 100,
          affected: 1,
          summary: `Employee moved to Offboarding; separation checklist retained for finalization.`,
          time: 'just now',
        },
      });
    }
  }

  async finalizeTermination(input: FinalizeTerminationInput): Promise<void> {
    const { employeeName, override = false } = input;
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

    // Statutory-leave termination lock: an employee on an active job-protected
    // leave (parental/maternity, sick, bereavement) cannot be terminated. The
    // only way through is an explicit admin override WITH the Human Rights
    // Code certification acknowledged — and that bypass is recorded.
    const approvedLeaves = await this.prisma.leaveRequest.findMany({
      where: { employeeId: matches[0].id, status: 'APPROVED' },
      select: { type: true, status: true, start: true, end: true },
    });
    const activeStatutory = findActiveStatutoryLeave(approvedLeaves, new Date());
    const usedStatutoryOverride = !!activeStatutory && !!input.statutoryOverride && !!input.hrCertified;
    if (activeStatutory && !usedStatutoryOverride) {
      const label = STATUTORY_LEAVE_LABELS[activeStatutory.type] ?? activeStatutory.type;
      throw new ConflictException(
        `${STATUTORY_LOCK_MARKER}: ${employeeName} is on an active statutory ${label} leave ` +
          `(until ${activeStatutory.end.toISOString().slice(0, 10)}). Terminating an employee on ` +
          `job-protected leave is blocked. To proceed, an admin must explicitly override AND certify ` +
          `compliance with the Human Rights Code.`,
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.prisma.employee.update({ where: { id: matches[0].id }, data: { status: 'TERMINATED' as any } });

    // Persist the termination details (type / reason / rehire / notes) and any
    // statutory override as an immutable record on the offboarding board. The
    // schema has no dedicated termination-detail fields, so the structured
    // details live in a completed HR/Payroll task label (documented gap).
    if (hasTerminationDetails(input) || usedStatutoryOverride) {
      await this.prisma.offboardingTask.create({
        data: {
          label: formatTerminationRecord(employeeName, input, usedStatutoryOverride),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          owner: 'HR_PAYROLL' as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          status: 'COMPLETED' as any,
          blocking: false,
        },
      });
    }
  }
}
