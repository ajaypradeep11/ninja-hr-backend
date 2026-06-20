// src/contexts/performance/infrastructure/performance.mapper.ts
import type { PerformanceReview, Pip, ReviewState, PipState } from '../domain/performance.types';

function invert<K extends string, V extends string>(m: Record<K, V>): Record<V, K> {
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k])) as Record<V, K>;
}

export const reviewStateToDb = {
  Draft: 'DRAFT',
  'Self-Evaluation': 'SELF_EVALUATION',
  'Manager-Evaluation': 'MANAGER_EVALUATION',
  Calibrated: 'CALIBRATED',
  Completed: 'COMPLETED',
} satisfies Record<ReviewState, string>;

export const reviewStateFromDb = invert(reviewStateToDb);

export const pipStateToDb = {
  Draft: 'DRAFT',
  Active: 'ACTIVE',
  Completed: 'COMPLETED',
} satisfies Record<PipState, string>;

export const pipStateFromDb = invert(pipStateToDb);

const iso = (d: Date): string => d.toISOString().slice(0, 10);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToReview(row: any): PerformanceReview {
  return {
    id: row.id,
    employee: row.employee.name,
    cycle: row.cycle,
    state: reviewStateFromDb[row.state as keyof typeof reviewStateFromDb],
    score: row.score ?? undefined,
    due: iso(row.due),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToPip(row: any): Pip {
  return {
    id: row.id,
    employee: row.employeeName,
    manager: row.manager,
    durationDays: row.durationDays,
    state: pipStateFromDb[row.state as keyof typeof pipStateFromDb],
    signedByManager: row.signedByManager,
    signedByEmployee: row.signedByEmployee,
    startDate: iso(row.startDate),
  };
}
