// src/contexts/onboarding/domain/checklist.service.ts
import type { ProvinceCode } from 'src/shared-kernel/province';
import type { ChecklistTask, TaskOwner, DataAccess } from './onboarding.types';

export const PROVINCE_POLICIES: Record<string, string[]> = {
  ON: ['AODA Awareness Training', 'Workplace Violence & Harassment Policy', 'Health & Safety Awareness (Ontario)'],
  BC: ['Bullying & Harassment (WorkSafeBC)', 'OHS Orientation (BC)'],
  QC: ['French Language Rights (Charter)', 'Law 25 Privacy Notice'],
  AB: ['OHS Orientation (Alberta)'],
  SK: ['OHS Orientation (Saskatchewan)'],
  MB: ['Workplace Safety & Health (Manitoba)'],
  NS: ['OHS Orientation (Nova Scotia)'],
  NB: ['OHS Orientation (New Brunswick)'],
};

export function mandatoryPolicies(province: ProvinceCode): string[] {
  return PROVINCE_POLICIES[province] ?? [];
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return h;
}

let tid = 0;
function mkTask(label: string, owner: TaskOwner, blocking = false, dataAccess: DataAccess = 'general'): ChecklistTask {
  return { id: `t${++tid}_${Math.abs(hash(label + owner))}`, label, owner, status: 'Pending', blocking, dataAccess };
}

const DEPT_TASKS: Record<string, () => ChecklistTask[]> = {
  Engineering: () => [
    mkTask('Provision dev environment & GitHub access', 'IT / Ops', true),
    mkTask('Assign engineering onboarding buddy', 'Manager'),
  ],
  Sales: () => [
    mkTask('Grant CRM access & assign territory', 'IT / Ops'),
    mkTask('Schedule product & pitch training', 'Manager'),
  ],
  Design: () => [mkTask('Provision Figma & design tooling', 'IT / Ops')],
  Finance: () => [mkTask('Grant ERP / ledger access', 'IT / Ops', true, 'banking')],
};

export function generateChecklist(department: string, province: ProvinceCode): ChecklistTask[] {
  const base: ChecklistTask[] = [
    mkTask('Send benefits enrollment package', 'HR'),
    mkTask('Collect signed handbook & policy acknowledgments', 'HR'),
    mkTask('Set up payroll profile', 'Finance', true, 'banking'),
    mkTask('Verify direct deposit & void cheque', 'Finance', true, 'banking'),
    mkTask('Confirm TD1 federal + provincial', 'Finance', false, 'general'),
    mkTask('Create corporate email address', 'IT / Ops'),
    mkTask('Provision laptop & hardware', 'IT / Ops', true),
    mkTask('Grant SSO + core app access', 'IT / Ops'),
    mkTask('Prepare first-week plan', 'Manager'),
  ];
  const training = mandatoryPolicies(province).map((p) => mkTask(`Assign: ${p}`, 'HR', true, 'general'));
  const deptExtra = (DEPT_TASKS[department] ?? (() => []))();
  return [...base, ...training, ...deptExtra];
}
