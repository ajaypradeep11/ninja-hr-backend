// src/contexts/onboarding/application/onboarding.settle.spec.ts
import { settle } from './onboarding.settle';
import type { OnboardingCase } from '../domain/onboarding.types';

const ready: OnboardingCase = {
  id: 'c1', token: 't1', name: 'A', title: 'x', department: 'Engineering', province: 'ON',
  startDate: '2026-07-01', personalEmail: 'a@b.com', status: 'Pending Verification', createdAt: '2026-06-01',
  forms: { personal: true, td1: true, directDeposit: true, benefits: true, handbook: true },
  checklist: [{ id: 't', label: 'x', owner: 'HR', status: 'Completed', blocking: true, dataAccess: 'general' }],
  documents: [], consent: [],
  policiesAttached: ['AODA Awareness Training', 'Workplace Violence & Harassment Policy', 'Health & Safety Awareness (Ontario)'],
  auditLog: [],
};

describe('settle', () => {
  it('persists the recomputed status when it changes', async () => {
    const calls: { id: string; status: string }[] = [];
    const repo = {
      findById: async () => ready,
      setStatus: async (id: string, status: string) => { calls.push({ id, status }); },
    } as never;
    const out = await settle(repo, 'c1');
    expect(out?.status).toBe('Ready to Activate');
    expect(calls).toEqual([{ id: 'c1', status: 'Ready to Activate' }]);
  });
});
