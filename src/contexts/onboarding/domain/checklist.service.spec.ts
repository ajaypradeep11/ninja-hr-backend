// src/contexts/onboarding/domain/checklist.service.spec.ts
import { generateChecklist, mandatoryPolicies } from './checklist.service';

describe('generateChecklist', () => {
  it('includes base + ON mandatory training + Engineering extras', () => {
    const list = generateChecklist('Engineering', 'ON');
    expect(list.some((t) => t.label === 'Set up payroll profile')).toBe(true);
    expect(list.some((t) => t.label === 'Assign: AODA Awareness Training')).toBe(true);
    expect(list.some((t) => t.label === 'Provision dev environment & GitHub access')).toBe(true);
  });
  it('mandatoryPolicies returns [] for unknown province key', () => {
    expect(mandatoryPolicies('AB')).toEqual(['OHS Orientation (Alberta)']);
  });
});
