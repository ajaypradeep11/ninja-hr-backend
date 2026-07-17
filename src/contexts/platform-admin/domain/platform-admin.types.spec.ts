import { severityFor } from './platform-admin.types';

describe('severityFor', () => {
  it('treats a guardrail block as a warning', () => {
    expect(severityFor('moderation')).toBe('warning');
  });

  it('treats an audit entry as info', () => {
    expect(severityFor('audit')).toBe('info');
  });

  // Guards the decision documented on severityFor: no source in the schema can
  // honestly produce 'error' today, so the Overview "Errors" bar reads zero
  // rather than showing an invented count. If a real failure state is added,
  // this test should be updated alongside the new mapping.
  it('never reports error, because no table records a failure state', () => {
    expect(['moderation', 'audit'].map((kind) => severityFor(kind as 'moderation' | 'audit'))).not.toContain('error');
  });
});
