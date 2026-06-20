// src/contexts/performance/infrastructure/performance.mapper.spec.ts
import {
  reviewStateToDb,
  reviewStateFromDb,
  pipStateToDb,
  pipStateFromDb,
  rowToReview,
  rowToPip,
} from './performance.mapper';

describe('reviewState maps', () => {
  it('maps Draft ↔ DRAFT', () => {
    expect(reviewStateToDb['Draft']).toBe('DRAFT');
    expect(reviewStateFromDb['DRAFT']).toBe('Draft');
  });

  it('maps Self-Evaluation ↔ SELF_EVALUATION', () => {
    expect(reviewStateToDb['Self-Evaluation']).toBe('SELF_EVALUATION');
    expect(reviewStateFromDb['SELF_EVALUATION']).toBe('Self-Evaluation');
  });

  it('maps Manager-Evaluation ↔ MANAGER_EVALUATION', () => {
    expect(reviewStateToDb['Manager-Evaluation']).toBe('MANAGER_EVALUATION');
    expect(reviewStateFromDb['MANAGER_EVALUATION']).toBe('Manager-Evaluation');
  });

  it('round-trips all review states', () => {
    const states = ['Draft', 'Self-Evaluation', 'Manager-Evaluation', 'Calibrated', 'Completed'] as const;
    for (const s of states) {
      const db = reviewStateToDb[s];
      expect(reviewStateFromDb[db]).toBe(s);
    }
  });
});

describe('pipState maps', () => {
  it('maps Active ↔ ACTIVE', () => {
    expect(pipStateToDb['Active']).toBe('ACTIVE');
    expect(pipStateFromDb['ACTIVE']).toBe('Active');
  });

  it('round-trips all pip states', () => {
    const states = ['Draft', 'Active', 'Completed'] as const;
    for (const s of states) {
      const db = pipStateToDb[s];
      expect(pipStateFromDb[db]).toBe(s);
    }
  });
});

describe('rowToReview', () => {
  it('maps a DB row to PerformanceReview shape', () => {
    const row = {
      id: 'rev1',
      employee: { name: 'Alice Smith' },
      cycle: 'H1 2026',
      state: 'SELF_EVALUATION',
      score: 4.2,
      due: new Date('2026-06-30T00:00:00Z'),
    };
    const review = rowToReview(row);
    expect(review).toEqual({
      id: 'rev1',
      employee: 'Alice Smith',
      cycle: 'H1 2026',
      state: 'Self-Evaluation',
      score: 4.2,
      due: '2026-06-30',
    });
  });

  it('omits score when null', () => {
    const row = {
      id: 'rev2',
      employee: { name: 'Bob Jones' },
      cycle: 'H2 2026',
      state: 'DRAFT',
      score: null,
      due: new Date('2026-12-31T00:00:00Z'),
    };
    const review = rowToReview(row);
    expect(review.score).toBeUndefined();
  });
});

describe('rowToPip', () => {
  it('maps a DB row to Pip shape', () => {
    const row = {
      id: 'pip1',
      employeeName: 'Carol White',
      manager: 'manager-id',
      durationDays: 90,
      state: 'ACTIVE',
      signedByManager: true,
      signedByEmployee: true,
      startDate: new Date('2026-05-01T00:00:00Z'),
    };
    const pip = rowToPip(row);
    expect(pip).toEqual({
      id: 'pip1',
      employee: 'Carol White',
      manager: 'manager-id',
      durationDays: 90,
      state: 'Active',
      signedByManager: true,
      signedByEmployee: true,
      startDate: '2026-05-01',
    });
  });
});
