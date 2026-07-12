// src/contexts/platform/domain/platform.types.ts

export type AgentStatus = 'Running' | 'Awaiting Approval' | 'Completed';

export interface AgentRun {
  id: string;
  intent: string;
  status: AgentStatus;
  progress: number;
  affected: number;
  summary: string;
  time: string;
}

export interface Integrations {
  google: boolean;
  m365: boolean;
  slack: boolean;
  sharepoint: boolean;
  esign: boolean;
  quickbooks: boolean;
}

/** Recurring performance review cadence (Cadence Configuration). */
export type ReviewCadence = 'Annual' | 'Bi-Annual' | 'Quarterly';

export const REVIEW_CADENCES: ReviewCadence[] = ['Annual', 'Bi-Annual', 'Quarterly'];

export interface CompanySettings {
  companyName: string;
  provinces: string[];
  integrations: Integrations;
  recognitionPublic: boolean;
  /** Stored inside the integrations JSON column — CompanySettings has no
   *  dedicated column and schema changes are off the table. */
  reviewCadence?: ReviewCadence;
  /**
   * Admin-managed department options for the onboarding preboard form.
   * Optional on writes (older clients omit it — the saved list is preserved);
   * always present on reads. Piggybacks on the integrations JSON column like
   * reviewCadence, for the same schema-freeze reason.
   */
  departments?: string[];
}

export const DEFAULT_DEPARTMENTS = [
  'Engineering', 'Design', 'Sales', 'Finance', 'Marketing', 'People', 'Operations',
];

export const DEFAULT_SETTINGS: CompanySettings = {
  companyName: 'NinjaHR',
  provinces: ['ON', 'BC', 'QC', 'SK'],
  integrations: {
    google: true,
    m365: true,
    slack: true,
    sharepoint: true,
    esign: false,
    quickbooks: true,
  },
  recognitionPublic: true,
  reviewCadence: 'Annual',
  departments: DEFAULT_DEPARTMENTS,
};

/* -------------------- Custom Calculator Engine --------------------- */

export type CalcCategory = 'Timesheet' | 'Accrual' | 'Bonus';
export type CalcOperator = '>' | '>=' | '<' | '<=' | '=';

/** One rule: IF <field> <operator> <threshold> THEN <action> <value>. */
export interface CalcRule {
  id: string;
  category: CalcCategory;
  field: string;
  operator: CalcOperator;
  threshold: number;
  action: string;
  value: number;
  active: boolean;
}

export interface CalcRuleInput {
  category: CalcCategory;
  field: string;
  operator: CalcOperator;
  threshold: number;
  action: string;
  value: number;
  active?: boolean;
}
