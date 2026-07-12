// src/contexts/onboarding/application/commands/reject-document.command.spec.ts
import { NotFoundException } from '@nestjs/common';
import { RejectDocumentHandler, RejectDocumentCommand } from './reject-document.command';
import type { OnboardingCase } from '../../domain/onboarding.types';

const caseWithRejectedDoc: OnboardingCase = {
  id: 'c1', token: 't1', name: 'A', title: 'x', department: 'Engineering', province: 'ON',
  startDate: '2026-07-01', personalEmail: 'a@b.com', status: 'Pending Verification', createdAt: '2026-06-01',
  forms: { personal: true, td1: true, directDeposit: true, benefits: true, handbook: true },
  checklist: [],
  documents: [
    { id: 'd1', name: 'TD1 2026 — Federal (signed)', type: 'Tax Form', folder: '02_Onboarding_and_Tax', status: 'Pending', hasFile: true },
  ],
  consent: [], taskAssignees: {}, policiesAttached: [], auditLog: [],
};

function makeRepo(overrides: Partial<Record<string, unknown>> = {}) {
  const calls = { reject: [] as [string, string][], audit: [] as string[], status: [] as string[] };
  const repo = {
    rejectDocument: async (caseId: string, docId: string) => {
      calls.reject.push([caseId, docId]);
      return 'TD1 2026 — Federal (signed)';
    },
    addAudit: async (_id: string, event: string) => { calls.audit.push(event); },
    findById: async () => caseWithRejectedDoc,
    setStatus: async (_id: string, status: string) => { calls.status.push(status); },
    ...overrides,
  };
  return { repo: repo as never, calls };
}

describe('RejectDocumentHandler', () => {
  it('rejects the document and records the note in the audit trail', async () => {
    const { repo, calls } = makeRepo();
    await new RejectDocumentHandler(repo).execute(
      new RejectDocumentCommand('c1', 'd1', 'Signature is missing on page 2'),
    );
    expect(calls.reject).toEqual([['c1', 'd1']]);
    expect(calls.audit).toEqual([
      'HR rejected document "TD1 2026 — Federal (signed)" — Signature is missing on page 2',
    ]);
  });

  it('keeps the case out of Ready to Activate while a rejected doc is outstanding', async () => {
    const { repo, calls } = makeRepo();
    const out = await new RejectDocumentHandler(repo).execute(
      new RejectDocumentCommand('c1', 'd1', 'Wrong year'),
    );
    // All forms are done but the rejected ('Pending') doc keeps the
    // verification gate closed — settle must not promote the case.
    expect(out?.status).toBe('Pending Verification');
    expect(calls.status).toEqual([]);
  });

  it('404s when the document is not on this case', async () => {
    const { repo, calls } = makeRepo({ rejectDocument: async () => null });
    await expect(
      new RejectDocumentHandler(repo).execute(new RejectDocumentCommand('c1', 'nope', 'n')),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(calls.audit).toEqual([]);
  });
});
