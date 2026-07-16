import { GUARD_CATEGORIES } from './guard-verdict';
import { REFUSALS, refusalVerdict } from './refusals';

describe('refusals', () => {
  it('defines every category', () => {
    for (const category of GUARD_CATEGORIES) expect(REFUSALS[category].length).toBeGreaterThan(20);
  });

  it('includes Canadian self-harm resources', () => {
    expect(REFUSALS.self_harm).toContain('1-833-456-4566');
    expect(REFUSALS.self_harm).toContain('9-8-8');
    expect(REFUSALS.self_harm).toContain('911');
  });

  it('builds blocked verdicts', () => {
    expect(refusalVerdict('sexual')).toEqual({
      allowed: false,
      category: 'sexual',
      refusalMessage: REFUSALS.sexual,
    });
  });
});
