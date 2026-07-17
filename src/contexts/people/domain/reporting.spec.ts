import { BadRequestException } from '@nestjs/common';
import { assertNoCycle } from './reporting';

describe('assertNoCycle', () => {
  it('accepts a chain that does not lead back to the employee', () => {
    expect(() => assertNoCycle(['m1', 'm2'], 'e1')).not.toThrow();
  });

  it('rejects a chain that loops back — the org chart would never terminate', () => {
    expect(() => assertNoCycle(['m1', 'e1'], 'e1')).toThrow(BadRequestException);
  });

  it('rejects managing yourself', () => {
    expect(() => assertNoCycle(['e1'], 'e1')).toThrow(BadRequestException);
  });
});
