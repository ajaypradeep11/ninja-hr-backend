import { BadRequestException, ConflictException, NotFoundException, Injectable } from '@nestjs/common';
import { TenantPrismaService } from 'src/platform/database/tenant-prisma.service';
import type {
  CreateEmployeeInput,
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
  constructor(private readonly prisma: TenantPrismaService) {}

  /** Redact fields non-HR viewers must not see in the roster/directory:
   *  - compensation (salary) is HR-only; leaking it to every employee is a
   *    confidentiality breach, so it is zeroed for non-HR viewers.
   *  - birthDate is cleared when the employee marked their birthday private. */
  private scrubForViewer(e: Employee, viewerIsHr: boolean): Employee {
    if (viewerIsHr) return e;
    return {
      ...e,
      salary: 0,
      ...(e.birthdayPrivate ? { birthDate: '' } : {}),
    };
  }

  /**
   * The employee directory. PRE_HIRE is excluded: a new hire gets their record
   * the moment they accept their invite (so they can sign in and work through
   * preboarding), but activation is what hires them — that is the point at
   * which they join the directory, and the activation audit trail says so.
   * Detail lookups (by id / by name) stay unfiltered so a pre-hire can still
   * load their own profile.
   */
  async getEmployees(viewerIsHr = false): Promise<Employee[]> {
    const rows = await this.prisma.employee.findMany({
      where: { status: { not: 'PRE_HIRE' } },
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => this.scrubForViewer(rowToEmployee(r), viewerIsHr));
  }

  async getEmployeeByName(name: string, viewerIsHr = false): Promise<Employee | null> {
    const rows = await this.prisma.employee.findMany({ where: { name }, take: 1 });
    return rows.length ? this.scrubForViewer(rowToEmployee(rows[0]), viewerIsHr) : null;
  }

  /* ------------------------- HRIS record ------------------------- */

  async getEmployeeDetail(id: string): Promise<EmployeeDetail> {
    const row = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        emergencyContacts: { orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }] },
        // omit the file binary — detail reads only need metadata + hasFile
        documents: { orderBy: { uploaded: 'desc' }, omit: { data: true } },
      },
    });
    if (!row) throw new NotFoundException(`Employee ${id} not found`);
    return rowToEmployeeDetail(row);
  }

  /**
   * Manual profile creation (Add Employee → "Add manually") — for people hired
   * or pre-boarded outside the system. Creates an ACTIVE Employee with the
   * next EMP-NNNN number plus an EMPLOYEE login (Firebase links by verified
   * email on first sign-in), mirroring what onboarding activation provisions.
   */
  async createEmployee(input: CreateEmployeeInput): Promise<EmployeeDetail> {
    const email = input.email.trim().toLowerCase();
    const dup = await this.prisma.employee.findFirst({ where: { email } });
    if (dup) throw new ConflictException(`An employee with ${email} already exists.`);
    if (input.birthDate && input.hireDate < input.birthDate) {
      throw new BadRequestException('Start date cannot be before the date of birth.');
    }
    let row;
    try {
      row = await this.prisma.employee.create({
        data: {
          name: input.name.trim(),
          title: input.title.trim(),
          department: input.department.trim(),
          province: input.province as never,
          email,
          hireDate: new Date(input.hireDate),
          birthDate: input.birthDate ? new Date(input.birthDate) : new Date('1970-01-01T00:00:00.000Z'),
          salary: input.salary ?? 0,
          status: 'ACTIVE',
          employeeNumber: await this.nextEmployeeNumber(),
          employmentType: input.employmentType
            ? (employmentTypeToDb[input.employmentType] as never)
            : undefined,
          workLocation: input.workLocation?.trim() || null,
          preferredName: input.preferredName?.trim() || null,
          phone: input.phone?.trim() || null,
          manager: input.manager?.trim() || null,
        },
      });
    } catch (e) {
      // Global unique(email) — the address may belong to another workspace.
      if ((e as { code?: string }).code === 'P2002') {
        throw new ConflictException(`An account already exists for ${email}.`);
      }
      throw e;
    }
    await this.prisma.user.create({ data: { employeeId: row.id, role: 'EMPLOYEE' } });
    return this.getEmployeeDetail(row.id);
  }

  /** Next EMP-NNNN directory number (max existing + 1). */
  private async nextEmployeeNumber(): Promise<string> {
    const rows = await this.prisma.employee.findMany({
      where: { employeeNumber: { startsWith: 'EMP-' } },
      select: { employeeNumber: true },
    });
    const max = rows
      .map((r) => Number(r.employeeNumber?.slice(4)))
      .filter((n) => Number.isFinite(n))
      .reduce((a, b) => Math.max(a, b), 0);
    return `EMP-${String(max + 1).padStart(4, '0')}`;
  }

  async updateEmployee(id: string, input: UpdateEmployeeInput): Promise<EmployeeDetail> {
    const has = <K extends keyof UpdateEmployeeInput>(k: K) => input[k] !== undefined;
    // Sanity check: an employee cannot start work before they were born. Compare
    // against the stored dates when only one side of the pair is being changed.
    if (has('hireDate') || has('birthDate')) {
      const current = await this.prisma.employee.findUnique({
        where: { id },
        select: { hireDate: true, birthDate: true },
      });
      if (!current) throw new NotFoundException(`Employee ${id} not found`);
      const hire = input.hireDate ?? current.hireDate.toISOString().slice(0, 10);
      const birth = input.birthDate ?? current.birthDate.toISOString().slice(0, 10);
      if (hire < birth) {
        throw new BadRequestException('Start date cannot be before date of birth');
      }
    }
    await this.prisma.employee.update({
      where: { id },
      data: {
        ...(has('name') && input.name ? { name: input.name } : {}),
        ...(has('hireDate') ? { hireDate: new Date(input.hireDate!) } : {}),
        ...(has('birthDate') ? { birthDate: new Date(input.birthDate!) } : {}),
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
