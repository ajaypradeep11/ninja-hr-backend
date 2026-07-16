import type { LlmClassifier } from '../llm-provider';
import { buildClassifierPayload, InputGuard, MAX_INPUT_CHARS } from './input-guard';
import { SlidingWindowRateLimiter } from './rate-limiter';
import { asClassifier } from './tokens';

const context = { userId: 'u1', recentTurns: [], useClassifier: true };
const makeGuard = (classify: jest.Mock) =>
  new InputGuard({ classify } as LlmClassifier, new SlidingWindowRateLimiter());

describe('InputGuard', () => {
  it('applies deterministic checks before classification', async () => {
    const classify = jest.fn();
    const guard = makeGuard(classify);
    expect(await guard.check('x'.repeat(MAX_INPUT_CHARS + 1), context)).toEqual({ kind: 'over_length' });
    expect(await guard.check('this is complete shit', context)).toMatchObject({ kind: 'blocked' });
    expect(classify).not.toHaveBeenCalled();
  });

  it('classifies and handles classifier failure', async () => {
    expect(await makeGuard(jest.fn().mockResolvedValue('{"category":"off_topic_coding"}')).check('code', context)).toMatchObject({ kind: 'blocked', verdict: { category: 'off_topic_coding' } });
    expect(await makeGuard(jest.fn().mockRejectedValue(new Error('down'))).check('leave', context)).toEqual({ kind: 'allowed', classifierDown: true });
  });

  it('skips classification offline', async () => {
    const classify = jest.fn();
    expect(await makeGuard(classify).check('leave', { ...context, useClassifier: false })).toEqual({ kind: 'allowed', classifierDown: false });
    expect(classify).not.toHaveBeenCalled();
  });

  it('builds payload from only the last two turns', () => {
    const payload = buildClassifierPayload('current', [
      { role: 'user', content: 'old' },
      { role: 'user', content: 'recent' },
      { role: 'assistant', content: 'answer' },
    ]);
    expect(payload).not.toContain('old');
    expect(payload).toContain('user: recent');
    expect(payload).toContain('assistant: answer');
  });

  it('adapts classifier-shaped values', async () => {
    await expect(asClassifier({}).classify('s', 't')).rejects.toThrow();
    const real = { classify: jest.fn().mockResolvedValue('allowed') };
    await expect(asClassifier(real).classify('s', 't')).resolves.toBe('allowed');
  });
});
