// src/contexts/workplace/domain/workplace.types.ts

export type CarrierStatus = 'Connected' | 'File-based' | 'Not connected';
export type CarrierMethod = 'API' | 'CSV / SFTP';
export type DocAccess = 'Employee' | 'Manager' | 'HR Admin' | 'Super Admin';

export interface BenefitsCarrier {
  id: string;
  name: string;
  status: CarrierStatus;
  enrolled: number;
  method: CarrierMethod;
  lastSync: string;
}

export interface VaultDocument {
  id: string;
  name: string;
  folder: string;
  type: string;
  uploaded: string; // ISO-10 date YYYY-MM-DD
  access: DocAccess;
}

export interface TrainingCourse {
  id: string;
  title: string;
  category: string;
  progress: number;
  mandatory: boolean;
  province?: string;
  due?: string; // ISO-10 date YYYY-MM-DD, optional
}
