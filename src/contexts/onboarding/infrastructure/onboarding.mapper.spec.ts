// src/contexts/onboarding/infrastructure/onboarding.mapper.spec.ts
import { caseStatusToDb, caseStatusFromDb, ownerToDb, ownerFromDb, maskProfile } from './onboarding.mapper';

describe('onboarding enum maps', () => {
  it('round-trips case status', () => {
    expect(caseStatusToDb['Pending Verification']).toBe('PENDING_VERIFICATION');
    expect(caseStatusFromDb['PENDING_VERIFICATION']).toBe('Pending Verification');
  });
  it('maps IT / Ops owner', () => {
    expect(ownerToDb['IT / Ops']).toBe('IT_OPS');
    expect(ownerFromDb['IT_OPS']).toBe('IT / Ops');
  });
});

describe('new-hire profile masking', () => {
  it('never returns raw SIN or bank account', () => {
    const masked = maskProfile({
      legalFirstName: 'Julianne',
      sin: '046454286',
      bankAccount: '123456789012',
      bankTransit: '00012',
    });
    expect(masked?.sin).toBe('••• ••• 286');
    expect(masked?.bankAccount).toBe('••••9012');
    // Transit is routing info, not a secret — passes through.
    expect(masked?.bankTransit).toBe('00012');
    expect(JSON.stringify(masked)).not.toContain('046454286');
    expect(JSON.stringify(masked)).not.toContain('123456789012');
  });
  it('handles absent profile', () => {
    expect(maskProfile(null)).toBeUndefined();
  });
});
