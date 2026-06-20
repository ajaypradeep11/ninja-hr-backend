// src/contexts/workplace/infrastructure/workplace.mapper.spec.ts
import {
  carrierStatusToDb,
  carrierStatusFromDb,
  carrierMethodToDb,
  carrierMethodFromDb,
  docAccessToDb,
  docAccessFromDb,
  rowToBenefitsCarrier,
  rowToVaultDocument,
  rowToTrainingCourse,
} from './workplace.mapper';

describe('workplace enum maps', () => {
  describe('carrierStatus', () => {
    it('round-trips File-based', () => {
      expect(carrierStatusToDb['File-based']).toBe('FILE_BASED');
      expect(carrierStatusFromDb['FILE_BASED']).toBe('File-based');
    });

    it('round-trips Not connected', () => {
      expect(carrierStatusToDb['Not connected']).toBe('NOT_CONNECTED');
      expect(carrierStatusFromDb['NOT_CONNECTED']).toBe('Not connected');
    });

    it('round-trips all three statuses', () => {
      const statuses = ['Connected', 'File-based', 'Not connected'] as const;
      for (const s of statuses) {
        const db = carrierStatusToDb[s];
        expect(carrierStatusFromDb[db]).toBe(s);
      }
    });
  });

  describe('carrierMethod', () => {
    it('round-trips CSV / SFTP', () => {
      expect(carrierMethodToDb['CSV / SFTP']).toBe('CSV_SFTP');
      expect(carrierMethodFromDb['CSV_SFTP']).toBe('CSV / SFTP');
    });

    it('round-trips all methods', () => {
      const methods = ['API', 'CSV / SFTP'] as const;
      for (const m of methods) {
        const db = carrierMethodToDb[m];
        expect(carrierMethodFromDb[db]).toBe(m);
      }
    });
  });

  describe('docAccess', () => {
    it('round-trips HR Admin', () => {
      expect(docAccessToDb['HR Admin']).toBe('HR_ADMIN');
      expect(docAccessFromDb['HR_ADMIN']).toBe('HR Admin');
    });

    it('round-trips Super Admin', () => {
      expect(docAccessToDb['Super Admin']).toBe('SUPER_ADMIN');
      expect(docAccessFromDb['SUPER_ADMIN']).toBe('Super Admin');
    });

    it('round-trips all access levels', () => {
      const levels = ['Employee', 'Manager', 'HR Admin', 'Super Admin'] as const;
      for (const l of levels) {
        const db = docAccessToDb[l];
        expect(docAccessFromDb[db]).toBe(l);
      }
    });
  });

  describe('rowToBenefitsCarrier', () => {
    it('maps a connected carrier row correctly', () => {
      const row = { id: 'b1', name: 'Sun Life', status: 'CONNECTED', enrolled: 38, method: 'API', lastSync: '2026-06-17' };
      const result = rowToBenefitsCarrier(row);
      expect(result).toEqual({ id: 'b1', name: 'Sun Life', status: 'Connected', enrolled: 38, method: 'API', lastSync: '2026-06-17' });
    });

    it('maps a file-based carrier row correctly', () => {
      const row = { id: 'b2', name: 'Manulife', status: 'FILE_BASED', enrolled: 0, method: 'CSV_SFTP', lastSync: '2026-06-15' };
      const result = rowToBenefitsCarrier(row);
      expect(result).toEqual({ id: 'b2', name: 'Manulife', status: 'File-based', enrolled: 0, method: 'CSV / SFTP', lastSync: '2026-06-15' });
    });
  });

  describe('rowToVaultDocument', () => {
    it('maps a document row and formats uploaded date', () => {
      const row = { id: 'v1', name: 'Offer Letter.pdf', folder: '02_Onboarding', type: 'Offer Letter', uploaded: new Date('2026-04-10T00:00:00.000Z'), access: 'EMPLOYEE' };
      const result = rowToVaultDocument(row);
      expect(result.uploaded).toBe('2026-04-10');
      expect(result.access).toBe('Employee');
    });

    it('maps HR_ADMIN access correctly', () => {
      const row = { id: 'v2', name: 'TD1.pdf', folder: '02_Onboarding', type: 'TD1 Form', uploaded: new Date('2026-04-12T00:00:00.000Z'), access: 'HR_ADMIN' };
      const result = rowToVaultDocument(row);
      expect(result.access).toBe('HR Admin');
    });
  });

  describe('rowToTrainingCourse', () => {
    it('maps a course with optional province and due date', () => {
      const row = { id: 't1', title: 'WHMIS 2015', category: 'Health & Safety', progress: 0, mandatory: true, province: null, due: new Date('2026-06-30T00:00:00.000Z') };
      const result = rowToTrainingCourse(row);
      expect(result.due).toBe('2026-06-30');
      expect(result.province).toBeUndefined();
    });

    it('maps a course with no due date', () => {
      const row = { id: 't2', title: 'EDI Training', category: 'Culture', progress: 60, mandatory: false, province: null, due: null };
      const result = rowToTrainingCourse(row);
      expect(result.due).toBeUndefined();
      expect(result.province).toBeUndefined();
    });

    it('maps province when present', () => {
      const row = { id: 't3', title: 'AODA', category: 'Compliance', progress: 100, mandatory: true, province: 'ON', due: null };
      const result = rowToTrainingCourse(row);
      expect(result.province).toBe('ON');
    });
  });
});
