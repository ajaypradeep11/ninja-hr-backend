// src/contexts/recruitment/domain/template-render.service.spec.ts
import { renderTemplate } from './template-render.service';

describe('renderTemplate', () => {
  it('substitutes known variables', () => {
    expect(
      renderTemplate('Hi {{candidate_name}}, thanks for applying to {{job_title}}!', {
        candidate_name: 'Ada',
        job_title: 'Engineer',
      }),
    ).toBe('Hi Ada, thanks for applying to Engineer!');
  });

  it('tolerates whitespace inside braces', () => {
    expect(renderTemplate('Hi {{ candidate_name }}', { candidate_name: 'Ada' })).toBe('Hi Ada');
  });

  it('marks missing variables visibly instead of leaving raw braces', () => {
    expect(renderTemplate('On {{interview_date}}', {})).toBe('On [interview_date]');
  });

  it('leaves text without variables untouched', () => {
    expect(renderTemplate('No vars here', {})).toBe('No vars here');
  });
});
