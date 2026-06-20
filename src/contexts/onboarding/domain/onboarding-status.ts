// src/contexts/onboarding/domain/onboarding-status.ts
import type { OnboardingCase, FormFlags, ChecklistTask } from './onboarding.types';
import { mandatoryPolicies } from './checklist.service';

export function formProgress(forms: FormFlags): number {
  const vals = Object.values(forms);
  return Math.round((vals.filter(Boolean).length / vals.length) * 100);
}

export function checklistProgress(checklist: ChecklistTask[]): number {
  if (!checklist.length) return 0;
  const done = checklist.filter((t) => t.status === 'Completed').length;
  return Math.round((done / checklist.length) * 100);
}

export function caseProgress(c: OnboardingCase): number {
  return Math.round((formProgress(c.forms) + checklistProgress(c.checklist)) / 2);
}

export interface Gate {
  ok: boolean;
  label: string;
  detail?: string;
}

export function activationGates(c: OnboardingCase): Gate[] {
  const blockingTasks = c.checklist.filter((t) => t.blocking);
  const blockingDone = blockingTasks.filter((t) => t.status === 'Completed');
  const unverified = c.documents.filter((d) => d.status === 'Needs Verification');
  const required = mandatoryPolicies(c.province);
  const missingPolicies = required.filter((p) => !c.policiesAttached.includes(p));
  const formsDone = formProgress(c.forms) === 100;

  return [
    { ok: formsDone, label: 'Employee completed all onboarding forms' },
    {
      ok: blockingTasks.length > 0 && blockingDone.length === blockingTasks.length,
      label: `Blocking checklist tasks complete (${blockingDone.length}/${blockingTasks.length})`,
    },
    { ok: unverified.length === 0, label: 'All documents verified by HR (human-in-the-loop)' },
    { ok: missingPolicies.length === 0, label: `Provincial mandatory policies attached (${c.province})` },
  ];
}

export function canActivate(c: OnboardingCase): boolean {
  return activationGates(c).every((g) => g.ok);
}

export function nextStatus(c: OnboardingCase): import('./onboarding.types').CaseStatus {
  if (c.status === 'Active' || c.status === 'Invited') return c.status;
  const formsDone = Object.values(c.forms).every(Boolean);
  if (!formsDone) return 'Forms In Progress';
  return canActivate(c) ? 'Ready to Activate' : 'Pending Verification';
}
