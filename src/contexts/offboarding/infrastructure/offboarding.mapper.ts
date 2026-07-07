// src/contexts/offboarding/infrastructure/offboarding.mapper.ts
import type { OffboardingOwner, OffboardingStatus, OffboardingTask } from '../domain/offboarding.types';

function invert<K extends string, V extends string>(m: Record<K, V>): Record<V, K> {
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k])) as Record<V, K>;
}

export const ownerToDb = {
  Manager: 'MANAGER',
  'IT / Ops': 'IT_OPS',
  'HR / Payroll': 'HR_PAYROLL',
} satisfies Record<OffboardingOwner, string>;

export const ownerFromDb = invert(ownerToDb);

export const statusToDb = {
  Pending: 'PENDING',
  'In-Progress': 'IN_PROGRESS',
  Completed: 'COMPLETED',
} satisfies Record<OffboardingStatus, string>;

export const statusFromDb = invert(statusToDb);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToTask(row: any): OffboardingTask {
  return {
    id: row.id,
    label: row.label,
    owner: ownerFromDb[row.owner as keyof typeof ownerFromDb],
    status: statusFromDb[row.status as keyof typeof statusFromDb],
    blocking: row.blocking,
    assignee: row.assignee ?? undefined,
  };
}
