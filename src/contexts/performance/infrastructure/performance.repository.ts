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

export interface NewPipInput {
  employee: string;
  manager: string;
  durationDays: number;
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
