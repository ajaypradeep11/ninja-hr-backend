// src/contexts/recruitment/infrastructure/recruitment.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/platform/database/prisma.service';
import type { Requisition, Candidate, CandidateStage } from '../domain/recruitment.types';
import {
  candidateStageToDb,
  rowToCandidate,
  rowToRequisition,
} from './recruitment.mapper';

export interface NewRequisitionInput {
  title: string;
  department: string;
  province: string;
  salaryMin: number;
  salaryMax: number;
}

@Injectable()
export class RecruitmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getRequisitions(): Promise<Requisition[]> {
    const rows = await this.prisma.requisition.findMany({
      orderBy: { openedDate: 'desc' },
    });
    return rows.map(rowToRequisition);
  }

  async getCandidates(): Promise<Candidate[]> {
    const rows = await this.prisma.candidate.findMany({
      orderBy: { matchScore: 'desc' },
    });
    return rows.map(rowToCandidate);
  }

  async publishRequisition(input: NewRequisitionInput): Promise<void> {
    await this.prisma.requisition.create({
      data: {
        title: input.title,
        department: input.department,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        province: input.province as any,
        type: 'FULL_TIME',
        salaryMin: input.salaryMin,
        salaryMax: input.salaryMax,
        status: 'PUBLISHED',
        applicants: 0,
        openedDate: new Date(),
      },
    });
  }

  async setCandidateStage(id: string, stage: CandidateStage): Promise<Candidate[]> {
    await this.prisma.candidate.update({
      where: { id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { stage: candidateStageToDb[stage] as any },
    });
    return this.getCandidates();
  }
}
