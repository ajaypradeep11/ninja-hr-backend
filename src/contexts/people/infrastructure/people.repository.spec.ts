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
