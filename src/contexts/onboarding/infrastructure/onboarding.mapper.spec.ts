// src/contexts/onboarding/infrastructure/onboarding.mapper.spec.ts
import { caseStatusToDb, caseStatusFromDb, ownerToDb, ownerFromDb } from './onboarding.mapper';

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
