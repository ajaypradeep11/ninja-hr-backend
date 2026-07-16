import { fallbackLetter, renderLetterTemplate } from './letter-merge';

const employee = {
  id: 'e1', name: 'Sam $& Lee', title: 'Engineer', department: 'R&D', province: 'ON',
  hireDate: new Date('2024-02-01T00:00:00Z'), salary: 123456, manager: 'Pat', employeeNumber: 'E-7',
};
const now = new Date('2026-07-15T12:00:00Z');

describe('letter merge', () => {
  it('renders only allowlisted fields and preserves unknown tokens', () => {
    const body = '{{employee_name}}|{{title}}|{{department}}|{{start_date}}|{{salary}}|{{manager_name}}|{{employee_number}}|{{today}}|{{company}}|{{bonus_amount}}';
    const text = renderLetterTemplate(body, employee, 'Acme', now);
    expect(text).toContain('Sam $& Lee|Engineer|R&D|February 1, 2024|$123,456|Pat|E-7|July 15, 2026|Acme|{{bonus_amount}}');
    expect(text).not.toContain('undefined');
  });

  it('creates a useful verification fallback', () => {
    expect(fallbackLetter('employment_verification', employee, 'Acme', now)).toContain('confirms that Sam $& Lee has been employed');
  });
});
