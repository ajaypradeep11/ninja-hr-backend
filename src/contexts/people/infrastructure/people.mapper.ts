import type { ProvinceCode } from 'src/shared-kernel/province';
import type { Employee, EmployeeStatus } from '../domain/people.types';

function invert<K extends string, V extends string>(m: Record<K, V>): Record<V, K> {
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k])) as Record<V, K>;
}

export const empStatusToDb = {
  Active: 'ACTIVE',
  'Pre-Hire': 'PRE_HIRE',
  'On Statutory Leave': 'ON_STATUTORY_LEAVE',
  Offboarding: 'OFFBOARDING',
  Terminated: 'TERMINATED',
} satisfies Record<EmployeeStatus, string>;

export const empStatusFromDb = invert(empStatusToDb);

const iso = (d: Date): string => d.toISOString().slice(0, 10);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToEmployee(row: any): Employee {
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    department: row.department,
    province: row.province as ProvinceCode,
    email: row.email,
    hireDate: iso(row.hireDate),
    birthDate: iso(row.birthDate),
    manager: row.manager ?? undefined,
    status: empStatusFromDb[row.status as keyof typeof empStatusFromDb],
    salary: row.salary,
  };
}
