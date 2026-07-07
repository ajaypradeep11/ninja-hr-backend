// src/contexts/recruitment/domain/approval.service.spec.ts
import { settleApprovals } from './approval.service';

describe('settleApprovals', () => {
  it('stays pending while any approver has not decided', () => {
    expect(settleApprovals(['PENDING', 'APPROVED'])).toBe('pending');
    expect(settleApprovals(['PENDING', 'PENDING'])).toBe('pending');
  });

  it('approves only when every approver approved', () => {
    expect(settleApprovals(['APPROVED'])).toBe('approved');
    expect(settleApprovals(['APPROVED', 'APPROVED', 'APPROVED'])).toBe('approved');
  });

  it('rejects as soon as any approver rejects, regardless of the rest', () => {
    expect(settleApprovals(['APPROVED', 'REJECTED'])).toBe('rejected');
    expect(settleApprovals(['REJECTED', 'PENDING'])).toBe('rejected');
  });

  it('treats an empty approver list as pending (never auto-approves)', () => {
    expect(settleApprovals([])).toBe('pending');
  });
});
