import {
  employmentTypeToDb,
  employmentTypeFromDb,
  reqStatusToDb,
  reqStatusFromDb,
  candidateStageToDb,
  candidateStageFromDb,
} from './recruitment.mapper';

describe('recruitment enum maps', () => {
  describe('employmentType', () => {
    it('round-trips Full-time', () => {
      expect(employmentTypeToDb['Full-time']).toBe('FULL_TIME');
      expect(employmentTypeFromDb['FULL_TIME']).toBe('Full-time');
    });

    it('round-trips all employment types', () => {
      const types = ['Full-time', 'Part-time', 'Contractor'] as const;
      for (const t of types) {
        const db = employmentTypeToDb[t];
        expect(employmentTypeFromDb[db]).toBe(t);
      }
    });
  });

  describe('reqStatus', () => {
    it('round-trips Published', () => {
      expect(reqStatusToDb['Published']).toBe('PUBLISHED');
      expect(reqStatusFromDb['PUBLISHED']).toBe('Published');
    });

    it('round-trips Pending Approval', () => {
      expect(reqStatusToDb['Pending Approval']).toBe('PENDING_APPROVAL');
      expect(reqStatusFromDb['PENDING_APPROVAL']).toBe('Pending Approval');
    });

    it('round-trips all requisition statuses', () => {
      const statuses = ['Draft', 'Pending Approval', 'Approved', 'Published'] as const;
      for (const s of statuses) {
        const db = reqStatusToDb[s];
        expect(reqStatusFromDb[db]).toBe(s);
      }
    });
  });

  describe('candidateStage', () => {
    it('round-trips AI Screened', () => {
      expect(candidateStageToDb['AI Screened']).toBe('AI_SCREENED');
      expect(candidateStageFromDb['AI_SCREENED']).toBe('AI Screened');
    });

    it('round-trips all candidate stages', () => {
      const stages = [
        'Applied',
        'AI Screened',
        'Interview',
        'Offer',
        'Hired',
        'Rejected',
      ] as const;
      for (const s of stages) {
        const db = candidateStageToDb[s];
        expect(candidateStageFromDb[db]).toBe(s);
      }
    });
  });
});
