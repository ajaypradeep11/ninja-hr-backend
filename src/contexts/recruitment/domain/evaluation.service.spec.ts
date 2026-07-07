// src/contexts/recruitment/domain/evaluation.service.spec.ts
import { summarizeEvaluations } from './evaluation.service';
import type { ScorecardEntry } from './recruitment.types';

function card(over: Partial<ScorecardEntry>): ScorecardEntry {
  return {
    id: 'x',
    panelistId: 'p',
    panelistName: 'P',
    recommendation: 'Yes',
    status: 'Submitted',
    submittedAt: '2026-07-04T00:00:00Z',
    ratings: [],
    ...over,
  };
}

describe('summarizeEvaluations', () => {
  it('averages ratings across submitted scorecards per criterion', () => {
    const cards = [
      card({ ratings: [{ criterionId: 'c1', criterionName: 'Tech', rating: 4 }] }),
      card({ ratings: [{ criterionId: 'c1', criterionName: 'Tech', rating: 2 }] }),
    ];
    const s = summarizeEvaluations(cards);
    expect(s.submittedCount).toBe(2);
    expect(s.perCriterion[0]).toMatchObject({ criterionId: 'c1', average: 3, count: 2 });
    expect(s.averageOverall).toBe(3);
  });

  it('excludes drafts from averages but counts them', () => {
    const cards = [
      card({ status: 'Draft', ratings: [{ criterionId: 'c1', criterionName: 'Tech', rating: 5 }] }),
      card({ status: 'Submitted', ratings: [{ criterionId: 'c1', criterionName: 'Tech', rating: 3 }] }),
    ];
    const s = summarizeEvaluations(cards);
    expect(s.draftCount).toBe(1);
    expect(s.submittedCount).toBe(1);
    expect(s.averageOverall).toBe(3); // draft's 5 ignored
  });

  it('ignores unrated (0) criteria', () => {
    const s = summarizeEvaluations([
      card({ ratings: [{ criterionId: 'c1', criterionName: 'Tech', rating: 0 }] }),
    ]);
    expect(s.averageOverall).toBeNull();
    expect(s.perCriterion).toHaveLength(0);
  });

  it('builds the recommendation mix', () => {
    const s = summarizeEvaluations([
      card({ recommendation: 'Strong Yes' }),
      card({ recommendation: 'Yes' }),
      card({ recommendation: 'Yes' }),
    ]);
    expect(s.recommendationMix).toEqual([
      { recommendation: 'Strong Yes', count: 1 },
      { recommendation: 'Yes', count: 2 },
    ]);
  });
});
