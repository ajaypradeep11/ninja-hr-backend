// src/contexts/identity/infrastructure/identity.mapper.ts
import type { RoleCode, RoleLabel, UserAccount } from '../domain/identity.types';

export const roleLabelFromDb: Record<RoleCode, RoleLabel> = {
  HR_ADMIN: 'HR Admin',
  MANAGER: 'Manager',
  EMPLOYEE: 'Employee',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToUserAccount(row: any): UserAccount {
  const roleCode = row.role as RoleCode;
  return {
    id: row.id,
    employeeId: row.employeeId,
    name: row.employee.name,
    title: row.employee.title,
    department: row.employee.department,
    role: roleLabelFromDb[roleCode],
    roleCode,
  };
}
