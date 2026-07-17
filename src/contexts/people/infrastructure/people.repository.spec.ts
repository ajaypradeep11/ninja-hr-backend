// src/contexts/people/infrastructure/people.repository.spec.ts
import { BadRequestException } from '@nestjs/common';
import { PeopleRepository } from './people.repository';
import type { TenantPrismaService } from 'src/platform/database/tenant-prisma.service';

const ROW = {
  id: 'e1',
  name: 'Jane Doe',
  title: 'Engineer',
  department: 'Engineering',
  province: 'ON',
  email: 'jane@company.ca',
  hireDate: new Date('2022-01-10T00:00:00Z'),
  birthDate: new Date('1990-05-05T00:00:00Z'),
  status: 'ACTIVE',
  salary: 100000,
  td1FederalOnFile: false,
  td1ProvincialOnFile: false,
  emergencyContacts: [],
  documents: [],
};

function makePrisma() {
  return {
    employee: {
      findUnique: jest.fn().mockResolvedValue(ROW),
      update: jest.fn().mockResolvedValue(ROW),
    },
  };
}

describe('PeopleRepository.updateEmployee date sanity', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let repo: PeopleRepository;

  beforeEach(() => {
    prisma = makePrisma();
    repo = new PeopleRepository(prisma as unknown as TenantPrismaService);
  });

  it('rejects a start date before the date of birth', async () => {
    await expect(repo.updateEmployee('e1', { hireDate: '1980-01-01' })).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.employee.update).not.toHaveBeenCalled();
  });

  it('rejects a date of birth after the stored start date', async () => {
    await expect(repo.updateEmployee('e1', { birthDate: '2023-01-01' })).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.employee.update).not.toHaveBeenCalled();
  });

  it('checks the incoming pair together when both dates change', async () => {
    await expect(
      repo.updateEmployee('e1', { hireDate: '2010-06-01', birthDate: '2011-01-01' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('persists valid hire and birth dates', async () => {
    await repo.updateEmployee('e1', { hireDate: '2023-03-15', birthDate: '1991-02-20' });
    expect(prisma.employee.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'e1' },
        data: expect.objectContaining({
          hireDate: new Date('2023-03-15'),
          birthDate: new Date('1991-02-20'),
        }),
      }),
    );
  });

  it('leaves dates untouched when the update carries neither', async () => {
    await repo.updateEmployee('e1', { title: 'Staff Engineer' });
    const data = prisma.employee.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('hireDate');
    expect(data).not.toHaveProperty('birthDate');
  });
});

describe('PeopleRepository.getEmployeeByName', () => {
  it('includes the manager relation, so the returned employee carries the manager NAME (not silently dropped)', async () => {
    const row = {
      ...ROW,
      managerId: 'm1',
      manager: { id: 'm1', name: 'Grace Hopper' },
    };
    const prisma = {
      employee: {
        findMany: jest.fn().mockResolvedValue([row]),
      },
    };
    const repo = new PeopleRepository(prisma as unknown as TenantPrismaService);

    const result = await repo.getEmployeeByName('Jane Doe', true);

    // The query must actually join the relation — without `include`, Prisma
    // never populates `row.manager`, and the mapper silently returns undefined
    // for every employee even when they do have a manager.
    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          manager: expect.objectContaining({ select: expect.objectContaining({ name: true }) }),
        }),
      }),
    );
    expect(result?.manager).toBe('Grace Hopper');
  });
});

describe('PeopleRepository.createEmployee (manual add)', () => {
  const input = {
    name: 'New Hire',
    title: 'Analyst',
    department: 'Finance',
    province: 'ON' as const,
    email: 'New.Hire@Example.com',
    hireDate: '2026-08-01',
  };

  function makeCreatePrisma(overrides: Record<string, unknown> = {}) {
    return {
      employee: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([{ employeeNumber: 'EMP-0013' }]),
        create: jest.fn().mockResolvedValue({ ...ROW, id: 'e-new' }),
        findUnique: jest.fn().mockResolvedValue({ ...ROW, id: 'e-new', emergencyContacts: [], documents: [] }),
        ...((overrides.employee as object) ?? {}),
      },
      user: { create: jest.fn().mockResolvedValue({ id: 'u-new' }) },
    };
  }

  it('creates an ACTIVE employee with the next EMP number and an EMPLOYEE login', async () => {
    const prisma = makeCreatePrisma();
    const repo = new PeopleRepository(prisma as unknown as TenantPrismaService);
    await repo.createEmployee(input);
    const data = prisma.employee.create.mock.calls[0][0].data;
    expect(data.email).toBe('new.hire@example.com'); // normalized
    expect(data.status).toBe('ACTIVE');
    expect(data.employeeNumber).toBe('EMP-0014'); // max existing + 1
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { employeeId: 'e-new', role: 'EMPLOYEE' },
    });
  });

  it('409s on a duplicate email without creating anything', async () => {
    const prisma = makeCreatePrisma({ employee: { findFirst: jest.fn().mockResolvedValue(ROW) } });
    const repo = new PeopleRepository(prisma as unknown as TenantPrismaService);
    await expect(repo.createEmployee(input)).rejects.toThrow('already exists');
    expect(prisma.employee.create).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('rejects a hire date before the birth date', async () => {
    const prisma = makeCreatePrisma();
    const repo = new PeopleRepository(prisma as unknown as TenantPrismaService);
    await expect(
      repo.createEmployee({ ...input, birthDate: '2027-01-01' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.employee.create).not.toHaveBeenCalled();
  });
});
