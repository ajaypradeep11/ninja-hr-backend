import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/platform/database/prisma.service';
import type { Employee, SalaryBenchmark } from '../domain/people.types';
import { rowToEmployee } from './people.mapper';

@Injectable()
export class PeopleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getEmployees(): Promise<Employee[]> {
    const rows = await this.prisma.employee.findMany({ orderBy: { name: 'asc' } });
    return rows.map(rowToEmployee);
  }

  async getEmployeeByName(name: string): Promise<Employee | null> {
    const rows = await this.prisma.employee.findMany({ where: { name }, take: 1 });
    return rows.length ? rowToEmployee(rows[0]) : null;
  }

  async headcountByDept(): Promise<{ dept: string; count: number }[]> {
    const grouped = await this.prisma.employee.groupBy({
      by: ['department'],
      _count: { _all: true },
    });
    return grouped
      .map((g) => ({ dept: g.department, count: g._count._all }))
      .sort((a, b) => b.count - a.count);
  }

  async salaryBenchmarks(): Promise<SalaryBenchmark[]> {
    const rows = await this.prisma.salaryBenchmark.findMany();
    return rows.map((s) => ({ role: s.role, low: s.low, high: s.high, current: s.current }));
  }
}
