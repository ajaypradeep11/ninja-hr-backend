// src/contexts/people/infrastructure/people.masking.spec.ts
import { maskTail, rowToEmployeeDetail } from './people.mapper';

describe('maskTail', () => {
  it('masks all but the last 3 of a SIN', () => {
    expect(maskTail('123456789', 3)).toBe('••••••789');
  });

  it('masks all but the last 4 of an account number', () => {
    expect(maskTail('12345678', 4)).toBe('••••5678');
  });

  it('ignores whitespace when masking', () => {
    expect(maskTail('123 456 789', 3)).toBe('••••••789');
  });

  it('returns undefined for empty values', () => {
    expect(maskTail(undefined)).toBeUndefined();
    expect(maskTail(null)).toBeUndefined();
    expect(maskTail('')).toBeUndefined();
  });
});

describe('rowToEmployeeDetail masking', () => {
  const base = {
    id: 'e1',
    name: 'Jane Doe',
    title: 'Engineer',
    department: 'Engineering',
    province: 'ON',
    email: 'jane@company.ca',
    hireDate: new Date('2022-01-10T00:00:00Z'),
    birthDate: new Date('1990-05-05T00:00:00Z'),
    status: 'ACTIVE',
    salary: 100000,
    td1FederalOnFile: true,
    td1ProvincialOnFile: false,
    emergencyContacts: [],
    documents: [],
  };

  it('never returns the raw SIN or account — only masked + presence flags', () => {
    const d = rowToEmployeeDetail({ ...base, sin: '123456789', bankAccount: '987654321', bankInstitution: 'RBC' });
    expect(d.sinMasked).toBe('••••••789');
    expect(d.hasSin).toBe(true);
    expect(d.bankAccountMasked).toBe('•••••4321');
    expect(d.hasBanking).toBe(true);
    // The object must not carry the raw fields under any key.
    expect(JSON.stringify(d)).not.toContain('123456789');
    expect(JSON.stringify(d)).not.toContain('987654321');
  });

  it('reports absence when sensitive data is missing', () => {
    const d = rowToEmployeeDetail(base);
    expect(d.hasSin).toBe(false);
    expect(d.sinMasked).toBeUndefined();
    expect(d.hasBanking).toBe(false);
  });
});
