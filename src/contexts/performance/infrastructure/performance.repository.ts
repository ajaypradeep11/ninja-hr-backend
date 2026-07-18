// src/contexts/performance/infrastructure/performance.repository.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TenantPrismaService } from 'src/platform/database/tenant-prisma.service';
import type { ActorContext } from 'src/platform/auth/actor-context';
import type { MyReviews, PerformanceReview, Pip } from '../domain/performance.types';
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

export interface NewReviewInput {
  employeeId: string;
  cycle: string;
  due: string; // ISO date
}

export interface UpdateReviewInput {
  selfEvaluation?: string;
  managerEvaluation?: string;
  score?: number;
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

  /**
   * The actor-scoped review surface, visibility-shaped (the industry-standard
   * independence gating: BambooHR/Lattice keep each side's writing hidden
   * until the other has committed):
   *  - `mine`: the actor's own reviews. The manager's evaluation and score are
   *    hidden until the review is Completed (shared).
   *  - `reports`: reviews of the actor's DIRECT REPORTS (by managerId — same
   *    reporting-line routing as leave). The employee's self-evaluation is
   *    hidden until they have submitted it, so the manager forms an
   *    independent opinion first.
   */
  async getMyReviews(actor: ActorContext): Promise<MyReviews> {
    if (!actor.employeeId) return { mine: [], reports: [] };
    const rows = await this.prisma.performanceReview.findMany({
      where: {
        OR: [{ employeeId: actor.employeeId }, { employee: { managerId: actor.employeeId } }],
      },
      include: { employee: true },
      orderBy: { due: 'asc' },
    });
    const mine: PerformanceReview[] = [];
    const reports: PerformanceReview[] = [];
    for (const row of rows) {
      const dto = rowToReview(row);
      if (row.employeeId === actor.employeeId) {
        if (dto.state !== 'Completed') {
          delete dto.managerEvaluation;
          delete dto.score;
        }
        mine.push(dto);
      } else {
        if (!row.selfSubmittedAt) delete dto.selfEvaluation;
        reports.push(dto);
      }
    }
    return { mine, reports };
  }

  /**
   * The employee submits their self-assessment. Only during Self-Evaluation,
   * only by the review's own employee. Submission locks the text and
   * auto-advances the review to Manager-Evaluation (race-guarded), so the
   * flow moves without HR touching every review.
   */
  async submitSelfEvaluation(id: string, text: string, actor: ActorContext): Promise<MyReviews> {
    const row = await this.prisma.performanceReview.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Review not found');
    if (!actor.employeeId || row.employeeId !== actor.employeeId) {
      throw new ForbiddenException('Only the review’s employee can submit the self-assessment');
    }
    if (row.state !== 'SELF_EVALUATION') {
      throw new ConflictException(
        row.state === 'DRAFT'
          ? 'This review has not been opened for self-evaluation yet'
          : 'The self-evaluation window for this review has closed',
      );
    }
    const updated = await this.prisma.performanceReview.updateMany({
      where: { id, state: 'SELF_EVALUATION' },
      data: { selfEvaluation: text, selfSubmittedAt: new Date(), state: 'MANAGER_EVALUATION' },
    });
    if (updated.count === 0) throw new ConflictException('Review changed state — reload and retry');
    return this.getMyReviews(actor);
  }

  /**
   * The assigned manager (reporting line) — or HR — submits the manager
   * evaluation and proposed rating. Only during Manager-Evaluation.
   * Auto-advances to Calibrated; HR then adjusts the score if needed and
   * completes (shares) the review.
   */
  async submitManagerEvaluation(
    id: string,
    text: string,
    score: number | undefined,
    actor: ActorContext,
  ): Promise<MyReviews> {
    const row = await this.prisma.performanceReview.findUnique({
      where: { id },
      include: { employee: { select: { managerId: true } } },
    });
    if (!row) throw new NotFoundException('Review not found');
    const isAssignedManager = !!actor.employeeId && row.employee.managerId === actor.employeeId;
    if (actor.role !== 'HR_ADMIN' && !isAssignedManager) {
      throw new ForbiddenException('Only the employee’s manager (or HR) can submit this evaluation');
    }
    if (row.state !== 'MANAGER_EVALUATION') {
      throw new ConflictException(
        row.state === 'DRAFT' || row.state === 'SELF_EVALUATION'
          ? 'The manager evaluation opens after the self-evaluation is submitted'
          : 'The manager-evaluation window for this review has closed',
      );
    }
    const updated = await this.prisma.performanceReview.updateMany({
      where: { id, state: 'MANAGER_EVALUATION' },
      data: {
        managerEvaluation: text,
        ...(score !== undefined ? { score } : {}),
        managerSubmittedAt: new Date(),
        state: 'CALIBRATED',
      },
    });
    if (updated.count === 0) throw new ConflictException('Review changed state — reload and retry');
    return this.getMyReviews(actor);
  }

  /** The employee acknowledges the shared (Completed) review. Idempotent. */
  async acknowledgeReview(id: string, actor: ActorContext): Promise<MyReviews> {
    const row = await this.prisma.performanceReview.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Review not found');
    if (!actor.employeeId || row.employeeId !== actor.employeeId) {
      throw new ForbiddenException('Only the review’s employee can acknowledge it');
    }
    if (row.state !== 'COMPLETED') {
      throw new ConflictException('A review can be acknowledged once it is completed and shared');
    }
    if (!row.acknowledgedAt) {
      await this.prisma.performanceReview.update({
        where: { id },
        data: { acknowledgedAt: new Date() },
      });
    }
    return this.getMyReviews(actor);
  }

  /** Start a review in Draft. Employee must exist (FK enforces the tenant). */
  async createReview(input: NewReviewInput): Promise<PerformanceReview[]> {
    await this.prisma.performanceReview.create({
      data: {
        employeeId: input.employeeId,
        cycle: input.cycle,
        due: new Date(input.due),
        state: 'DRAFT',
      },
    });
    return this.getReviews();
  }

  /** Fill in review content — only the fields provided are written. */
  async updateReview(id: string, input: UpdateReviewInput): Promise<PerformanceReview[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {};
    if (input.selfEvaluation !== undefined) data.selfEvaluation = input.selfEvaluation;
    if (input.managerEvaluation !== undefined) data.managerEvaluation = input.managerEvaluation;
    if (input.score !== undefined) data.score = input.score;
    try {
      await this.prisma.performanceReview.update({ where: { id }, data });
    } catch {
      throw new NotFoundException(`Performance review ${id} not found`);
    }
    return this.getReviews();
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
        select: { id: true, name: true, manager: { select: { name: true } }, hireDate: true },
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
              summary: `90-day probationary review created for ${emp.name}; manager ${emp.manager?.name ?? 'unassigned'} notified to complete it by Day 80.`,
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
