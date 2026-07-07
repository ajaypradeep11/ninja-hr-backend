// src/contexts/identity/domain/identity.types.ts

/** Backend role codes (mirror the Prisma enum). */
export type RoleCode = 'HR_ADMIN' | 'MANAGER' | 'EMPLOYEE';

/** Human-facing role labels used across the UI. */
export type RoleLabel = 'HR Admin' | 'Manager' | 'Employee';

/** A switchable demo login — a User joined with its Employee profile. */
export interface UserAccount {
  id: string;
  employeeId: string;
  name: string;
  title: string;
  department: string;
  role: RoleLabel;
  roleCode: RoleCode;
}
