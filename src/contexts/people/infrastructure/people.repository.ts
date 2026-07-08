import { NotFoundException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/platform/database/prisma.service';
import type {
  Employee,
  EmployeeDetail,
  EmergencyContactInput,
  SalaryBenchmark,
  UpdateEmployeeInput,
} from '../domain/people.types';
import {
  employmentTypeToDb,
  empStatusToDb,
  payFrequencyToDb,
  rowToEmployee,
  rowToEmployeeDetail,
  workEligibilityToDb,
} from './people.mapper';

@Injectable()
export class PeopleRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Privacy: when an employee marked their birthday private, non-HR viewers
   *  get an empty birthDate — team calendars/dashboards simply skip it. */
  private scrubBirthday(e: Employee, viewerIsHr: boolean): Employee {
    if (viewerIsHr || !e.birthdayPrivate) return e;
    return { ...e, birthDate: '' };
  }

  async getEmployees(viewerIsHr = false): Promise<Employee[]> {
    const rows = await this.prisma.employee.findMany({ orderBy: { name: 'asc' } });
    return rows.map((r) => this.scrubBirthday(rowToEmployee(r), viewerIsHr));
  }

  async getEmployeeByName(name: string, viewerIsHr = false): Promise<Employee | null> {
    const rows = await this.prisma.employee.findMany({ where: { name }, take: 1 });
    return rows.length ? this.scrubBirthday(rowToEmployee(rows[0]), viewerIsHr) : null;
  }

  /* ------------------------- HRIS record ------------------------- */

  async getEmployeeDetail(id: string): Promise<EmployeeDetail> {
    const row = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        emergencyContacts: { orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }] },
        documents: { orderBy: { uploaded: 'desc' } },
      },
    });
    if (!row) throw new NotFoundException(`Employee ${id} not found`);
    return rowToEmployeeDetail(row);
  }

  async updateEmployee(id: string, input: UpdateEmployeeInput): Promise<EmployeeDetail> {
    const has = <K extends keyof UpdateEmployeeInput>(k: K) => input[k] !== undefined;
    await this.prisma.employee.update({
      where: { id },
      data: {
        ...(has('title') ? { title: input.title } : {}),
        ...(has('department') ? { department: input.department } : {}),
        ...(has('manager') ? { manager: input.manager || null } : {}),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(has('status') ? { status: empStatusToDb[input.status!] as any } : {}),
        ...(has('salary') ? { salary: input.salary } : {}),
        ...(has('employeeNumber') ? { employeeNumber: input.employeeNumber || null } : {}),
        ...(has('birthdayPrivate') ? { birthdayPrivate: input.birthdayPrivate } : {}),
        ...(has('preferredName') ? { preferredName: input.preferredName || null } : {}),
        ...(has('pronouns') ? { pronouns: input.pronouns || null } : {}),
        ...(has('personalEmail') ? { personalEmail: input.personalEmail || null } : {}),
        ...(has('phone') ? { phone: input.phone || null } : {}),
        ...(has('addressStreet') ? { addressStreet: input.addressStreet || null } : {}),
        ...(has('addressCity') ? { addressCity: input.addressCity || null } : {}),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(has('addressProvince') ? { addressProvince: (input.addressProvince as any) || null } : {}),
        ...(has('addressPostal') ? { addressPostal: input.addressPostal || null } : {}),
        ...(has('employmentType')
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { employmentType: (employmentTypeToDb[input.employmentType!] as any) ?? null }
          : {}),
        ...(has('workLocation') ? { workLocation: input.workLocation || null } : {}),
        ...(has('payFrequency')
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { payFrequency: (payFrequencyToDb[input.payFrequency!] as any) ?? null }
          : {}),
        ...(has('workEligibility')
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { workEligibility: (workEligibilityToDb[input.workEligibility!] as any) ?? null }
          : {}),
        ...(has('workPermitExpiry')
          ? { workPermitExpiry: input.workPermitExpiry ? new Date(input.workPermitExpiry) : null }
          : {}),
        ...(has('td1FederalOnFile') ? { td1FederalOnFile: input.td1FederalOnFile } : {}),
        ...(has('td1ProvincialOnFile') ? { td1ProvincialOnFile: input.td1ProvincialOnFile } : {}),
        ...(has('sin') ? { sin: input.sin || null } : {}),
        ...(has('bankInstitution') ? { bankInstitution: input.bankInstitution || null } : {}),
        ...(has('bankTransit') ? { bankTransit: input.bankTransit || null } : {}),
        ...(has('bankAccount') ? { bankAccount: input.bankAccount || null } : {}),
      },
    });
    return this.getEmployeeDetail(id);
  }

  async addEmergencyContact(employeeId: string, input: EmergencyContactInput): Promise<EmployeeDetail> {
    await this.prisma.employee.findUniqueOrThrow({ where: { id: employeeId } }).catch(() => {
      throw new NotFoundException(`Employee ${employeeId} not found`);
    });
    if (input.isPrimary) {
      await this.prisma.emergencyContact.updateMany({ where: { employeeId }, data: { isPrimary: false } });
    }
    await this.prisma.emergencyContact.create({
      data: {
        employeeId,
        name: input.name,
        relationship: input.relationship,
        phone: input.phone,
        altPhone: input.altPhone ?? null,
        email: input.email ?? null,
        isPrimary: input.isPrimary ?? false,
      },
    });
    return this.getEmployeeDetail(employeeId);
  }

  async deleteEmergencyContact(employeeId: string, contactId: string): Promise<EmployeeDetail> {
    const res = await this.prisma.emergencyContact.deleteMany({ where: { id: contactId, employeeId } });
    if (res.count === 0) throw new NotFoundException(`Emergency contact ${contactId} not found`);
    return this.getEmployeeDetail(employeeId);
  }

  async headcountByDept(): Promise<{ dept: string; count: number }[]> {
    const grouped = await this.prisma.employee.groupBy({
      by: ['department'],
      // Headcount means people currently employed — terminated employees and
      // pre-hires must not inflate the numbers.
      where: { status: { in: ['ACTIVE', 'ON_STATUTORY_LEAVE'] } },
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
