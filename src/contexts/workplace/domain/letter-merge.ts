import type { LetterKind, LetterMergeEmployee } from './workplace.types';

function date(value: Date): string {
  return value.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function renderLetterTemplate(
  body: string,
  employee: LetterMergeEmployee,
  companyName: string,
  now: Date,
): string {
  const fields: Record<string, string> = {
    '{{employee_name}}': employee.name,
    '{{title}}': employee.title,
    '{{department}}': employee.department,
    '{{start_date}}': date(employee.hireDate),
    '{{salary}}': employee.salary.toLocaleString('en-CA', {
      style: 'currency',
      currency: 'CAD',
      maximumFractionDigits: 0,
    }),
    '{{manager_name}}': employee.manager ?? 'your manager',
    '{{employee_number}}': employee.employeeNumber ?? '—',
    '{{today}}': date(now),
    '{{company}}': companyName,
  };
  return body.replace(/\{\{[a-z_]+\}\}/g, (token) => fields[token] ?? token);
}

const FALLBACKS: Record<LetterKind, string> = {
  employment_verification:
    '{{today}}\n\nTo whom it may concern,\n\nThis letter confirms that {{employee_name}} has been employed by {{company}} as {{title}} in the {{department}} department since {{start_date}}.\n\nSincerely,\n{{company}}',
  promotion:
    '{{today}}\n\nDear {{employee_name}},\n\nWe are pleased to confirm your promotion to {{title}} with {{company}}.\n\nSincerely,\n{{company}}',
  probation:
    '{{today}}\n\nDear {{employee_name}},\n\nThis letter concerns your probationary employment as {{title}} with {{company}}.\n\nSincerely,\n{{company}}',
  cover:
    '{{today}}\n\nDear {{employee_name}},\n\nPlease find the enclosed information regarding your employment with {{company}}.\n\nSincerely,\n{{company}}',
  custom:
    '{{today}}\n\nDear {{employee_name}},\n\nThis letter is regarding your employment as {{title}} with {{company}}.\n\nSincerely,\n{{company}}',
};

export function fallbackLetter(
  kind: LetterKind = 'employment_verification',
  employee: LetterMergeEmployee,
  companyName: string,
  now: Date,
): string {
  return renderLetterTemplate(FALLBACKS[kind], employee, companyName, now);
}
