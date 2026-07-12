// src/contexts/performance/infrastructure/performance.repository.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from 'src/platform/database/tenant-prisma.service';
import type { PerformanceReview, Pip } from '../domain/performance.types';
import {
  reviewStateToDb,
  reviewStateFromDb,
  pipStateToDb,
  rowToReview,
  rowToPip,
} from './performance.mapper';
import { nextReviewState } from '../domain/review-flow';
import {
  PROBATION_CYCLE,
  probationAction,
  probationDueDate,
  tenureDays,
} from '../domain/probation';

export interface NewPipInput {
  employee: string;
  manager: string;
  durationDays: number;
}

export interface ProbationSweepResult {
  /** Employees whose 90-day probationary review was just auto-initialized. */
  initialized: string[];
  /** Employees at Day 80+ whose probationary review is still open. */
  escalated: string[];
}

@Injectable()
export class PerformanceRepository {
  constructor(private readonly prisma: TenantPrismaService) {}

  async getReviews(): Promise<PerformanceReview[]> {
    const rows = await this.prisma.performanceReview.findMany({
      include: { employee: true },
      orderBy: { due: 'asc' },
    });
    return rows.map(rowToReview);
  }

  async getPips(): Promise<Pip[]> {
    const rows = await this.prisma.pip.findMany({
      orderBy: { startDate: 'desc' },
    });
    return rows.map(rowToPip);
  }

  async advanceReviewState(id: string): Promise<PerformanceReview[]> {
    const raw = await this.prisma.performanceReview.findUnique({ where: { id } });
    if (!raw) throw new NotFoundException(`Performance review ${id} not found`);
    const currentLabel =
      reviewStateFromDb[raw.state as keyof typeof reviewStateFromDb];
    const next = nextReviewState(currentLabel);
    // Guarded write: only advances if the state is still what we read, so two
    // racing requests cannot skip a stage.
    await this.prisma.performanceReview.updateMany({
      where: { id, state: raw.state },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { state: reviewStateToDb[next] as any },
    });
    return this.getReviews();
  }

  /**
   * Tenure-based probationary automation. Runs when HR opens the Performance
   * dashboard (this codebase has no cron infra — automations surface through
   * the agent-run feed, same as the offboarding agent):
   *  - Day 60: auto-initialize the 90-day probationary review + notify the
   *    manager via an agent-run entry.
   *  - Day 80: escalate while the probationary review is still open.
   * Idempotent: reviews are created once per employee, and agent-run entries
   * are deduped by intent so a dashboard reload never spams the feed.
   */
  async runProbationSweep(now = new Date()): Promise<ProbationSweepResult> {
    const [employees, probationReviews, runs] = await Promise.all([
      this.prisma.employee.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, manager: true, hireDate: true },
      }),
      this.prisma.performanceReview.findMany({ where: { cycle: PROBATION_CYCLE } }),
      this.prisma.agentRun.findMany({ select: { intent: true } }),
    ]);
    const reviewByEmployee = new Map(probationReviews.map((r) => [r.employeeId, r]));
    const seenIntents = new Set(runs.map((r) => r.intent));

    const result: ProbationSweepResult = { initialized: [], escalated: [] };
    for (const emp of employees) {
      const review = reviewByEmployee.get(emp.id);
      const action = probationAction({
        tenureDays: tenureDays(emp.hireDate, now),
        hasProbationReview: !!review,
        reviewCompleted: review?.state === 'COMPLETED',
      });

      if (action === 'initialize') {
        await this.prisma.performanceReview.create({
          data: {
            employeeId: emp.id,
            cycle: PROBATION_CYCLE,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            state: 'DRAFT' as any,
            due: probationDueDate(emp.hireDate),
          },
        });
        const intent = `Day-60 probation trigger: initialized 90-day review for ${emp.name}`;
        if (!seenIntents.has(intent)) {
          await this.prisma.agentRun.create({
            data: {
              intent,
              status: 'COMPLETED',
              progress: 100,
              affected: 1,
              summary: `90-day probationary review created for ${emp.name}; manager ${emp.manager ?? 'unassigned'} notified to complete it by Day 80.`,
              time: 'just now',
            },
          });
        }
        result.initialized.push(emp.name);
      } else if (action === 'escalate') {
        const intent = `Day-80 probation escalation: 90-day review for ${emp.name} still open`;
        if (!seenIntents.has(intent)) {
          await this.prisma.agentRun.create({
            data: {
              intent,
              status: 'AWAITING_APPROVAL',
              progress: 100,
              affected: 1,
              summary: `${emp.name} is past Day 80 of probation with the 90-day review unfinished — decide extension or termination before statutory notice applies at Day 90.`,
              time: 'just now',
            },
          });
        }
        result.escalated.push(emp.name);
      }
    }
    return result;
  }

  async issuePip(input: NewPipInput): Promise<Pip[]> {
    const employeeName = input.employee.trim();
    if (!employeeName) throw new BadRequestException('PIP employee name is required');
    // Link to the employee record when one matches; keep the name either way.
    const emp = await this.prisma.employee.findFirst({ where: { name: employeeName } });
    await this.prisma.pip.create({
      data: {
        employeeName,
        employeeId: emp?.id ?? null,
        manager: input.manager,
        durationDays: input.durationDays,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        state: pipStateToDb['Active'] as any,
        // The issuing manager signs at creation; the employee's acknowledgment
        // must never be fabricated — it stays false until they actually sign.
        signedByManager: true,
        signedByEmployee: false,
        startDate: new Date(),
      },
    });
    return this.getPips();
  }
}
