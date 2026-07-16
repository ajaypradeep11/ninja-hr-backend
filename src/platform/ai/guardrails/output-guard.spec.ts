import { makeCanary, OutputGuard } from './output-guard';

describe('OutputGuard', () => {
  const guard = new OutputGuard();
  const context = { canary: 'cnry_0123456789abcdef', persona: 'employee' as const, otherEmployeeNames: ['Sarah Mitchell'] };

  it('creates unique canaries', () => {
    expect(makeCanary()).toMatch(/^cnry_[0-9a-f]{16}$/);
    expect(makeCanary()).not.toBe(makeCanary());
  });

  it('blocks canary, other employee PII, and profanity', () => {
    expect(guard.check(context.canary, context)).toMatchObject({ allowed: false, category: 'prompt_injection' });
    expect(guard.check('sarah mitchell has leave', context)).toMatchObject({ allowed: false, category: 'pii_leak' });
    expect(guard.check('Your manager is an asshole', context)).toMatchObject({ allowed: false, category: 'harassment_profanity' });
  });

  it('allows clean output and admin employee access', () => {
    expect(guard.check('You have four sick days.', context)).toEqual({ allowed: true });
    expect(guard.check('Sarah Mitchell has leave.', { ...context, persona: 'admin' })).toEqual({ allowed: true });
  });
});
