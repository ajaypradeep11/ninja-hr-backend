// src/contexts/workplace/infrastructure/workplace.mapper.spec.ts
import {
  docAccessToDb,
  docAccessFromDb,
  rowToVaultDocument,
  rowToTrainingCourse,
  rowToTrainingAssignment,
} from './workplace.mapper';

describe('workplace enum maps', () => {
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
    it('maps a company course catalog row', () => {
      const row = {
        id: 't1',
        title: 'WHMIS 2015',
        category: 'Health & Safety',
        description: 'Hazardous materials.',
        contentUrl: 'https://example.com/whmis',
        durationMins: 45,
        passMark: 80,
        active: true,
      };
      const result = rowToTrainingCourse(row);
      expect(result.title).toBe('WHMIS 2015');
      expect(result.durationMins).toBe(45);
      expect(result.active).toBe(true);
    });

    it('surfaces assignment counts when included', () => {
      const row = {
        id: 't2',
        title: 'Security',
        category: 'Security',
        active: true,
        _count: { assignments: 3 },
        assignments: [{ status: 'COMPLETED' }, { status: 'ASSIGNED' }, { status: 'COMPLETED' }],
      };
      const result = rowToTrainingCourse(row);
      expect(result.assignedCount).toBe(3);
      expect(result.completedCount).toBe(2);
    });
  });

  describe('rowToTrainingAssignment', () => {
    it('maps an assignment with friendly status', () => {
      const row = {
        id: 'a1',
        courseId: 't1',
        course: { title: 'WHMIS', category: 'Health & Safety', contentUrl: null },
        employeeId: 'e1',
        employee: { name: 'Jane Doe' },
        status: 'IN_PROGRESS',
        progress: 40,
        assignedAt: new Date('2026-07-01T00:00:00Z'),
        dueDate: new Date('2026-08-31T00:00:00Z'),
        completedAt: null,
      };
      const result = rowToTrainingAssignment(row);
      expect(result.status).toBe('In-Progress');
      expect(result.courseTitle).toBe('WHMIS');
      expect(result.dueDate).toBe('2026-08-31');
    });
  });
});
