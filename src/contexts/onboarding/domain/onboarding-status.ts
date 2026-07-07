// src/contexts/onboarding/domain/onboarding-status.ts
import type { OnboardingCase, FormFlags, ChecklistTask } from './onboarding.types';

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
  const formsDone = formProgress(c.forms) === 100;

  // Policy attachment is no longer an activation condition — policy
  // acknowledgment is handled by the employee's handbook consent step.
  return [
    { ok: formsDone, label: 'Employee completed all onboarding forms' },
    {
      // Vacuously true when the checklist has no blocking tasks — otherwise a
      // checklist edited to contain zero blocking tasks can never activate.
      ok: blockingDone.length === blockingTasks.length,
      label: `Blocking checklist tasks complete (${blockingDone.length}/${blockingTasks.length})`,
    },
    { ok: unverified.length === 0, label: 'All documents verified by HR (human-in-the-loop)' },
  ];
}

export function canActivate(c: OnboardingCase): boolean {
  return activationGates(c).every((g) => g.ok);
}

export function nextStatus(c: OnboardingCase): import('./onboarding.types').CaseStatus {
  if (c.status === 'Active') return 'Active';
  if (c.status === 'Invited') {
    // Invited moves to Forms In Progress as soon as the employee starts the
    // wizard; it never skips ahead — finalize is what advances past forms.
    return Object.values(c.forms).some(Boolean) ? 'Forms In Progress' : 'Invited';
  }
  const formsDone = Object.values(c.forms).every(Boolean);
  if (!formsDone) return 'Forms In Progress';
  return canActivate(c) ? 'Ready to Activate' : 'Pending Verification';
}
