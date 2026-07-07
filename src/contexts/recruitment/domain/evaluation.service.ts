// src/contexts/recruitment/domain/evaluation.service.ts
// Aggregates interviewers' scorecards into quantitative KPIs — turning
// qualitative notes into measurable data (average ratings, recommendation mix)
// for the analytics dashboard. Pure → spec-tested.
import type { EvaluationSummary, ScorecardEntry } from './recruitment.types';

const REC_ORDER: EvaluationSummary['recommendationMix'][number]['recommendation'][] = [
  'Strong Yes',
  'Yes',
  'No',
  'Strong No',
];

export function summarizeEvaluations(scorecards: ScorecardEntry[]): EvaluationSummary {
  const submitted = scorecards.filter((s) => s.status === 'Submitted');
  const draftCount = scorecards.length - submitted.length;

  // Per-criterion averages across all submitted scorecards.
  const byCriterion = new Map<string, { name: string; sum: number; count: number }>();
  let overallSum = 0;
  let overallCount = 0;
  for (const s of submitted) {
    for (const r of s.ratings) {
      if (r.rating <= 0) continue;
      const entry = byCriterion.get(r.criterionId) ?? { name: r.criterionName, sum: 0, count: 0 };
      entry.sum += r.rating;
      entry.count += 1;
      byCriterion.set(r.criterionId, entry);
      overallSum += r.rating;
      overallCount += 1;
    }
  }

  const perCriterion = [...byCriterion.entries()].map(([criterionId, v]) => ({
    criterionId,
    name: v.name,
    average: Math.round((v.sum / v.count) * 10) / 10,
    count: v.count,
  }));

  const recommendationMix = REC_ORDER.map((recommendation) => ({
    recommendation,
    count: submitted.filter((s) => s.recommendation === recommendation).length,
  })).filter((m) => m.count > 0);

  return {
    submittedCount: submitted.length,
    draftCount,
    averageOverall: overallCount > 0 ? Math.round((overallSum / overallCount) * 10) / 10 : null,
    perCriterion,
    recommendationMix,
  };
}
