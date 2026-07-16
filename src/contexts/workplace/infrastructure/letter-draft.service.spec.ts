import { NotFoundException } from '@nestjs/common';
import { LetterDraftService } from './letter-draft.service';

const employee = { id: 'e1', name: 'Avery', title: 'Engineer', department: 'Product', province: 'ON', hireDate: new Date('2024-01-01Z'), salary: 100000, manager: 'Morgan', employeeNumber: 'E1' };
const actor = { userId: 'u1', employeeId: 'm1', employeeName: 'Morgan', department: 'Product', role: 'MANAGER' as const, realUserId: 'u1', companyId: 'c1' };

describe('LetterDraftService', () => {
  function setup(result = { text: '', verdict: { allowed: true }, live: false }) {
    const prisma = { employee: { findUnique: jest.fn().mockResolvedValue(employee) }, letterTemplate: { findUnique: jest.fn().mockResolvedValue({ body: 'Dear {{employee_name}} at {{company}}' }) }, company: { findUnique: jest.fn().mockResolvedValue({ name: 'Acme' }) } };
    const guarded = { ask: jest.fn().mockResolvedValue(result) };
    return { service: new LetterDraftService(prisma as never, guarded as never), prisma, guarded };
  }

  it('returns the deterministic merge while offline and uses the manager guard persona', async () => {
    const { service, guarded } = setup();
    await expect(service.draft({ employeeId: 'e1', templateId: 't1', instructions: 'Friendly' }, actor)).resolves.toEqual({ text: 'Dear Avery at Acme', live: false });
    expect(guarded.ask).toHaveBeenCalledWith(expect.objectContaining({ persona: 'employee', userId: 'u1', maxTokens: 4096, temperature: 0.2, otherEmployeeNames: [] }));
    expect(guarded.ask.mock.calls[0][0].messages).toEqual([{ role: 'user', content: 'Friendly' }]);
  });

  it('hides a non-report', async () => {
    const { service, prisma } = setup();
    prisma.employee.findUnique.mockResolvedValue({ ...employee, manager: 'Someone else' });
    await expect(service.draft({ employeeId: 'e1', instructions: 'Draft' }, actor)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns a blocked refusal without falling back', async () => {
    const blocked = { text: 'Cannot help with that.', verdict: { allowed: false, category: 'unsafe', refusalMessage: 'Cannot help with that.' }, live: true };
    const { service } = setup(blocked);
    await expect(service.draft({ employeeId: 'e1', templateId: 't1', instructions: 'Unsafe' }, { ...actor, role: 'HR_ADMIN' })).resolves.toEqual({ text: 'Cannot help with that.', live: true, blockedCategory: 'unsafe' });
  });
});
