// src/contexts/workplace/infrastructure/workplace.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/platform/database/prisma.service';
import type { BenefitsCarrier, VaultDocument, TrainingCourse } from '../domain/workplace.types';
import { rowToBenefitsCarrier, rowToVaultDocument, rowToTrainingCourse } from './workplace.mapper';

@Injectable()
export class WorkplaceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getBenefitsCarriers(): Promise<BenefitsCarrier[]> {
    const rows = await this.prisma.benefitsCarrier.findMany();
    return rows.map(rowToBenefitsCarrier);
  }

  async getVaultDocuments(): Promise<VaultDocument[]> {
    const rows = await this.prisma.vaultDocument.findMany({ orderBy: { uploaded: 'desc' } });
    return rows.map(rowToVaultDocument);
  }

  async getTrainingCourses(): Promise<TrainingCourse[]> {
    const rows = await this.prisma.trainingCourse.findMany({ orderBy: { title: 'asc' } });
    return rows.map(rowToTrainingCourse);
  }
}
