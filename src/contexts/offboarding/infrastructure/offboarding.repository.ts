// src/contexts/offboarding/infrastructure/offboarding.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/platform/database/prisma.service';
import type { OffboardingStatus, OffboardingTask } from '../domain/offboarding.types';
import { statusToDb, rowToTask } from './offboarding.mapper';

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

  async finalizeTermination(employeeName: string): Promise<void> {
    const emp = await this.prisma.employee.findFirst({ where: { name: employeeName } });
    if (emp) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.prisma.employee.update({ where: { id: emp.id }, data: { status: 'TERMINATED' as any } });
    }
  }
}
