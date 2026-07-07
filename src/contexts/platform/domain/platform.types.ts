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

export interface CompanySettings {
  companyName: string;
  provinces: string[];
  integrations: Integrations;
  recognitionPublic: boolean;
}

export const DEFAULT_SETTINGS: CompanySettings = {
  companyName: 'TestHR Inc.',
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
