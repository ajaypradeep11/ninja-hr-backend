// src/contexts/performance/infrastructure/performance.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/platform/database/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

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
    if (raw) {
      const currentLabel =
        reviewStateFromDb[raw.state as keyof typeof reviewStateFromDb];
      const next = nextReviewState(currentLabel);
      await this.prisma.performanceReview.update({
        where: { id },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { state: reviewStateToDb[next] as any },
      });
    }
    return this.getReviews();
  }

  async issuePip(input: NewPipInput): Promise<Pip[]> {
    await this.prisma.pip.create({
      data: {
        employeeName: input.employee,
        manager: input.manager,
        durationDays: input.durationDays,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        state: pipStateToDb['Active'] as any,
        signedByManager: true,
        signedByEmployee: true,
        startDate: new Date(),
      },
    });
    return this.getPips();
  }
}
