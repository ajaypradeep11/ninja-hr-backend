// src/contexts/recruitment/domain/anti-bias.service.spec.ts
import { ForbiddenException } from '@nestjs/common';
import { assertManualRejection, AUTO_REJECTION_RULES_SUPPORTED } from './anti-bias.service';
import type { ActorContext } from 'src/platform/auth/actor-context';

const human: ActorContext = {
  userId: 'u1',
  employeeId: 'e1',
  employeeName: 'Sarah Mitchell',
  department: 'People',
  role: 'HR_ADMIN',
  realUserId: 'u1',
  companyId: 'c1',
};

const automation: ActorContext = {
  userId: null,
  employeeId: null,
  employeeName: null,
  department: null,
  role: 'HR_ADMIN',
  realUserId: null,
  companyId: 'c1',
};

describe('Anti-Bias Shield', () => {
  it('is hardcoded: auto-rejection rules are not a supported feature', () => {
    // A compile-time const, not config — flipping this requires a code change
    // that this spec is designed to catch in review.
    expect(AUTO_REJECTION_RULES_SUPPORTED).toBe(false);
  });

  it('allows a rejection by an identified human reviewer', () => {
    expect(() => assertManualRejection(human)).not.toThrow();
  });

  it('blocks a rejection with no human identity, regardless of role', () => {
    expect(() => assertManualRejection(automation)).toThrow(ForbiddenException);
  });
});
