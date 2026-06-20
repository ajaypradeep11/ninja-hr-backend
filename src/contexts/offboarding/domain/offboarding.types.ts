// src/contexts/offboarding/domain/offboarding.types.ts

export type OffboardingOwner = 'Manager' | 'IT / Ops' | 'HR / Payroll';

export type OffboardingStatus = 'Pending' | 'In-Progress' | 'Completed';

export interface OffboardingTask {
  id: string;
  label: string;
  owner: OffboardingOwner;
  status: OffboardingStatus;
  blocking: boolean;
}
