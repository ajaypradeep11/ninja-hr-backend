// src/contexts/onboarding/application/commands/activate.command.spec.ts
import { ConflictException } from '@nestjs/common';
import { ActivateHandler, ActivateCommand } from './activate.command';
import type { OnboardingCase } from '../../domain/onboarding.types';

// A case that passes every activation gate: all forms done, blocking tasks
// completed, every document verified.
const readyCase: OnboardingCase = {
  id: 'c1', token: 't1', name: 'Jordan Henderson', title: 'Engineer', department: 'Engineering',
  province: 'ON', startDate: '2026-07-01', personalEmail: 'jordan@example.com',
  status: 'Pending Verification', createdAt: '2026-06-01',
  forms: { personal: true, td1: true, directDeposit: true, benefits: true, handbook: true },
  checklist: [{ id: 'task1', label: 'Sign policy', owner: 'HR', status: 'Completed', blocking: true, dataAccess: 'general' }],
  documents: [{ id: 'd1', name: 'TD1', type: 'Tax form', folder: '02', status: 'Verified' } as never],
  consent: [], taskAssignees: {}, policiesAttached: [], auditLog: [],
};

function makeRepo(c: OnboardingCase = readyCase) {
  const calls = {
    setStatus: [] as [string, string][],
    audit: [] as string[],
    provisioned: [] as string[],
    published: [] as string[],
    promoted: [] as string[],
  };
  const repo = {
    findById: async () => c,
    setStatus: async (id: string, status: string) => { calls.setStatus.push([id, status]); },
    addAudit: async (_id: string, event: string) => { calls.audit.push(event); },
    provisionEmployee: async (id: string) => {
      calls.provisioned.push(id);
      return { created: true, employeeId: 'emp1' };
    },
    // Default false = the employee was not sitting at PRE_HIRE (nothing to
    // promote); the tests that care flip this per-case.
    activateEmployee: async (employeeId: string) => { calls.promoted.push(employeeId); return false; },
    publishVerifiedDocsToVault: async (id: string) => { calls.published.push(id); return 1; },
  };
  return { repo: repo as never, calls };
}

const AUDIT_CREATED = 'Employee record created — now listed in the employee directory';
const AUDIT_ACTIVATED = 'Employee record activated — now listed in the employee directory';

describe('ActivateHandler', () => {
  it('activates, provisions the Employee record, then files verified docs', async () => {
    const { repo, calls } = makeRepo();
    await new ActivateHandler(repo).execute(new ActivateCommand('c1'));
    expect(calls.setStatus).toEqual([['c1', 'Active']]);
    // Provisioning must run BEFORE vault publication — the vault links docs by
    // the (just-created) employee record.
    expect(calls.provisioned).toEqual(['c1']);
    expect(calls.published).toEqual(['c1']);
    expect(calls.audit).toContain(AUDIT_CREATED);
  });

  it('skips the provisioning audit line for an already-existing employee', async () => {
    const { repo, calls } = makeRepo();
    (repo as { provisionEmployee: unknown }).provisionEmployee = async () => ({ created: false, employeeId: 'emp1' });
    await new ActivateHandler(repo).execute(new ActivateCommand('c1'));
    expect(calls.audit).not.toContain(AUDIT_CREATED);
  });

  // The normal path since invite acceptance provisions: the hire already exists
  // at PRE_HIRE, so activation's job is to promote them into the directory.
  it('promotes the PRE_HIRE employee the invite acceptance created', async () => {
    const { repo, calls } = makeRepo();
    (repo as { provisionEmployee: unknown }).provisionEmployee = async () => ({ created: false, employeeId: 'emp1' });
    (repo as { activateEmployee: unknown }).activateEmployee = async (id: string) => {
      calls.promoted.push(id);
      return true; // was PRE_HIRE
    };
    await new ActivateHandler(repo).execute(new ActivateCommand('c1'));
    expect(calls.setStatus).toEqual([['c1', 'Active']]);
    expect(calls.promoted).toEqual(['emp1']);
    expect(calls.audit).toContain(AUDIT_ACTIVATED);
    expect(calls.published).toEqual(['c1']);
  });

  it('does not log an activation line when the employee was already ACTIVE', async () => {
    const { repo, calls } = makeRepo();
    (repo as { provisionEmployee: unknown }).provisionEmployee = async () => ({ created: false, employeeId: 'emp1' });
    await new ActivateHandler(repo).execute(new ActivateCommand('c1'));
    expect(calls.audit).not.toContain(AUDIT_ACTIVATED);
  });

  it('blocks activation (409) when a gate fails — nothing is provisioned', async () => {
    const notReady = { ...readyCase, forms: { ...readyCase.forms, td1: false } };
    const { repo, calls } = makeRepo(notReady);
    await expect(new ActivateHandler(repo).execute(new ActivateCommand('c1'))).rejects.toThrow(ConflictException);
    expect(calls.setStatus).toEqual([]);
    expect(calls.provisioned).toEqual([]);
  });

  it('replay on an Active case with an existing employee changes nothing', async () => {
    const active = { ...readyCase, status: 'Active' as const };
    const { repo, calls } = makeRepo(active);
    (repo as { provisionEmployee: unknown }).provisionEmployee = async () => ({ created: false, employeeId: 'emp1' });
    const out = await new ActivateHandler(repo).execute(new ActivateCommand('c1'));
    expect(out?.status).toBe('Active');
    expect(calls.setStatus).toEqual([]);
    expect(calls.published).toEqual([]);
  });

  it('replay on an Active case SELF-HEALS a missing employee record', async () => {
    // Cases activated before activation provisioned employees: re-clicking
    // Activate creates the missing record and files the verified docs.
    const active = { ...readyCase, status: 'Active' as const };
    const { repo, calls } = makeRepo(active);
    await new ActivateHandler(repo).execute(new ActivateCommand('c1'));
    expect(calls.setStatus).toEqual([]); // status untouched
    expect(calls.provisioned).toEqual(['c1']);
    expect(calls.published).toEqual(['c1']);
    expect(calls.audit).toContain(AUDIT_CREATED);
  });
});
