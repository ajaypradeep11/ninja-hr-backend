// src/contexts/onboarding/domain/onboarding-status.spec.ts
import { nextStatus, canActivate } from './onboarding-status';
import type { OnboardingCase } from './onboarding.types';

function baseCase(over: Partial<OnboardingCase> = {}): OnboardingCase {
  return {
    id: 'c1', token: 't1', name: 'A B', title: 'Eng', department: 'Engineering',
    province: 'ON', startDate: '2026-07-01', personalEmail: 'a@b.com',
    status: 'Pending Verification', createdAt: '2026-06-01',
    forms: { personal: true, td1: true, directDeposit: true, benefits: true, handbook: true },
    checklist: [], documents: [], consent: [], policiesAttached: [], auditLog: [],
    ...over,
  };
}

describe('nextStatus', () => {
  it('keeps Invited and Active terminal-ish', () => {
    expect(nextStatus(baseCase({ status: 'Invited' }))).toBe('Invited');
    expect(nextStatus(baseCase({ status: 'Active' }))).toBe('Active');
  });
  it('returns Forms In Progress when forms incomplete', () => {
    const c = baseCase({ forms: { personal: false, td1: true, directDeposit: true, benefits: true, handbook: true } });
    expect(nextStatus(c)).toBe('Forms In Progress');
  });
  it('returns Pending Verification when gates not all green', () => {
    const c = baseCase({ documents: [{ id: 'd', name: 'x', type: 't', folder: 'f', status: 'Needs Verification' }] });
    expect(nextStatus(c)).toBe('Pending Verification');
  });
});

describe('canActivate', () => {
  it('is false when mandatory ON policies missing', () => {
    const c = baseCase({ policiesAttached: [] });
    expect(canActivate(c)).toBe(false);
  });
});
