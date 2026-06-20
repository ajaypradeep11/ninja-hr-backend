// src/contexts/workplace/infrastructure/workplace.mapper.ts
import type { BenefitsCarrier, CarrierStatus, CarrierMethod, DocAccess, VaultDocument, TrainingCourse } from '../domain/workplace.types';

function invert<K extends string, V extends string>(m: Record<K, V>): Record<V, K> {
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k])) as Record<V, K>;
}

/* Carrier status */
export const carrierStatusToDb = {
  Connected: 'CONNECTED',
  'File-based': 'FILE_BASED',
  'Not connected': 'NOT_CONNECTED',
} satisfies Record<CarrierStatus, string>;

export const carrierStatusFromDb = invert(carrierStatusToDb);

/* Carrier method */
export const carrierMethodToDb = {
  API: 'API',
  'CSV / SFTP': 'CSV_SFTP',
} satisfies Record<CarrierMethod, string>;

export const carrierMethodFromDb = invert(carrierMethodToDb);

/* Document access */
export const docAccessToDb = {
  Employee: 'EMPLOYEE',
  Manager: 'MANAGER',
  'HR Admin': 'HR_ADMIN',
  'Super Admin': 'SUPER_ADMIN',
} satisfies Record<DocAccess, string>;

export const docAccessFromDb = invert(docAccessToDb);

const iso = (d: Date): string => d.toISOString().slice(0, 10);

/* Row mappers */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToBenefitsCarrier(row: any): BenefitsCarrier {
  return {
    id: row.id,
    name: row.name,
    status: carrierStatusFromDb[row.status as keyof typeof carrierStatusFromDb],
    enrolled: row.enrolled,
    method: carrierMethodFromDb[row.method as keyof typeof carrierMethodFromDb],
    lastSync: row.lastSync,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToVaultDocument(row: any): VaultDocument {
  return {
    id: row.id,
    name: row.name,
    folder: row.folder,
    type: row.type,
    uploaded: iso(row.uploaded),
    access: docAccessFromDb[row.access as keyof typeof docAccessFromDb],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToTrainingCourse(row: any): TrainingCourse {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    progress: row.progress,
    mandatory: row.mandatory,
    province: row.province ?? undefined,
    due: row.due ? iso(row.due) : undefined,
  };
}
