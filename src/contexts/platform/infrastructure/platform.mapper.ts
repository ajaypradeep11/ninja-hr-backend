// src/contexts/platform/infrastructure/platform.mapper.ts
import type { AgentRun, AgentStatus, CompanySettings, Integrations } from '../domain/platform.types';

function invert<K extends string, V extends string>(m: Record<K, V>): Record<V, K> {
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k])) as Record<V, K>;
}

export const agentStatusToDb = {
  Running: 'RUNNING',
  'Awaiting Approval': 'AWAITING_APPROVAL',
  Completed: 'COMPLETED',
} satisfies Record<AgentStatus, string>;

export const agentStatusFromDb = invert(agentStatusToDb);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToAgentRun(row: any): AgentRun {
  return {
    id: row.id,
    intent: row.intent,
    status: agentStatusFromDb[row.status as keyof typeof agentStatusFromDb],
    progress: row.progress,
    affected: row.affected,
    summary: row.summary,
    time: row.time,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function settingsRowToDto(row: any): CompanySettings {
  return {
    companyName: row.companyName,
    provinces: row.provinces,
    integrations: row.integrations as unknown as Integrations,
    recognitionPublic: row.recognitionPublic,
  };
}
