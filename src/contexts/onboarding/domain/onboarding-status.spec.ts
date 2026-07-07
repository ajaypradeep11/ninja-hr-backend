// src/contexts/onboarding/domain/onboarding-status.spec.ts
import { nextStatus, canActivate } from './onboarding-status';
import type { OnboardingCase } from './onboarding.types';

function baseCase(over: Partial<OnboardingCase> = {}): OnboardingCase {
  return {
    id: 'c1', token: 't1', name: 'A B', title: 'Eng', department: 'Engineering',
    province: 'ON', startDate: '2026-07-01', personalEmail: 'a@b.com',
    status: 'Pending Verification', createdAt: '2026-06-01',
    forms: { personal: true, td1: true, directDeposit: true, benefits: true, handbook: true },
    checklist: [], documents: [], consent: [], policiesAttached: [], auditLog: [], taskAssignees: {},
    ...over,
  };
}

describe('nextStatus', () => {
  it('keeps Active terminal and Invited stable until forms start', () => {
    const untouched = { personal: false, td1: false, directDeposit: false, benefits: false, handbook: false };
    expect(nextStatus(baseCase({ status: 'Invited', forms: untouched }))).toBe('Invited');
    expect(nextStatus(baseCase({ status: 'Active' }))).toBe('Active');
  });
  it('moves Invited to Forms In Progress once any form is marked', () => {
    const started = { personal: true, td1: false, directDeposit: false, benefits: false, handbook: false };
    expect(nextStatus(baseCase({ status: 'Invited', forms: started }))).toBe('Forms In Progress');
  });
  it('returns Forms In Progress when forms incomplete', () => {
    const c = baseCase({ forms: { personal: false, td1: true, directDeposit: true, benefits: true, handbook: true } });
    expect(nextStatus(c)).toBe('Forms In Progress');
  });
  it('returns Pending Verification when gates not all green', () => {
    const c = baseCase({ documents: [{ id: 'd', name: 'x', type: 't', folder: 'f', status: 'Needs Verification', hasFile: false }] });
    expect(nextStatus(c)).toBe('Pending Verification');
  });
});

describe('canActivate', () => {
  it('does NOT require provincial policies attached (removed as a gate)', () => {
    const c = baseCase({ policiesAttached: [] });
    expect(canActivate(c)).toBe(true);
  });
  it('is false while a document still needs verification', () => {
    const c = baseCase({
      policiesAttached: [],
      documents: [{ id: 'd', name: 'x', type: 't', folder: 'f', status: 'Needs Verification', hasFile: false }],
    });
    expect(canActivate(c)).toBe(false);
  });
});
