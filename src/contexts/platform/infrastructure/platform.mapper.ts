// src/contexts/platform/infrastructure/platform.mapper.ts
import type { AgentRun, AgentStatus, CalcCategory, CalcRule, CompanySettings, Integrations } from '../domain/platform.types';
import { DEFAULT_DEPARTMENTS, DEFAULT_JOB_TITLES } from '../domain/platform.types';

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
    items: Array.isArray(row.items) ? row.items.map(rowToAgentRunItem) : [],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToAgentRunItem(row: any): AgentRun['items'][number] {
  const raw = row?.payload && typeof row.payload === 'object' && !Array.isArray(row.payload) ? row.payload : {};
  const valid = typeof raw.employeeName === 'string' && typeof raw.documentName === 'string' && typeof raw.body === 'string';
  const mode = raw.mode === 'signature' ? 'signature' : 'save';
  return {
    id: String(row?.id ?? ''), employeeId: String(row?.employeeId ?? ''),
    status: ['Pending', 'Issued', 'Failed'].includes(row?.status) ? row.status : 'Failed',
    payload: {
      employeeName: typeof raw.employeeName === 'string' ? raw.employeeName : 'Unknown employee',
      documentName: typeof raw.documentName === 'string' ? raw.documentName : 'Letter.txt',
      body: typeof raw.body === 'string' ? raw.body : '', mode,
      aiPersonalized: raw.aiPersonalized === true,
      ...(typeof raw.error === 'string' ? { error: raw.error } : !valid ? { error: 'Invalid historical payload' } : {}),
      ...(typeof raw.vaultDocumentId === 'string' ? { vaultDocumentId: raw.vaultDocumentId } : {}),
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function settingsRowToDto(row: any): CompanySettings {
  // reviewCadence + departments piggyback on the integrations JSON column (no
  // dedicated columns exist) — lift them out so the API shape stays flat and typed.
  const { reviewCadence, departments, jobTitles, ...integrations } = (row.integrations ?? {}) as Record<string, unknown>;
  return {
    companyName: row.companyName,
    provinces: row.provinces,
    integrations: integrations as unknown as Integrations,
    recognitionPublic: row.recognitionPublic,
    reviewCadence: (reviewCadence as CompanySettings['reviewCadence']) ?? 'Annual',
    departments:
      Array.isArray(departments) && departments.length
        ? (departments as string[])
        : DEFAULT_DEPARTMENTS,
    jobTitles:
      Array.isArray(jobTitles) && jobTitles.length ? (jobTitles as string[]) : DEFAULT_JOB_TITLES,
  };
}

/* -------------------- Custom Calculator Engine --------------------- */

export const calcCategoryToDb = {
  Timesheet: 'TIMESHEET',
  Accrual: 'ACCRUAL',
  Bonus: 'BONUS',
} satisfies Record<CalcCategory, string>;

export const calcCategoryFromDb = Object.fromEntries(
  Object.entries(calcCategoryToDb).map(([k, v]) => [v, k]),
) as Record<string, CalcCategory>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToCalcRule(row: any): CalcRule {
  return {
    id: row.id,
    category: calcCategoryFromDb[row.category] ?? 'Timesheet',
    field: row.field,
    operator: row.operator as CalcRule['operator'],
    threshold: row.threshold,
    action: row.action,
    value: row.value,
    active: row.active,
  };
}
