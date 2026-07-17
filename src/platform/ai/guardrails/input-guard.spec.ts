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

  it('scopes anonymous rate-limit buckets per tenant, not one global bucket', async () => {
    const limiter = new SlidingWindowRateLimiter(1); // 1 request/min to trip fast
    const tenant = { companyId: 'company-a' };
    const guard = new InputGuard(
      { classify: jest.fn() } as unknown as LlmClassifier,
      limiter,
      tenant as never,
    );
    const anon = { userId: null, recentTurns: [], useClassifier: false };
    expect(await guard.check('hello', anon)).toEqual({ kind: 'allowed', classifierDown: false });
    // Same tenant's anonymous lane is now exhausted…
    expect(await guard.check('hello', anon)).toEqual({ kind: 'rate_limited' });
    // …but another tenant's anonymous lane is NOT starved by it.
    tenant.companyId = 'company-b';
    expect(await guard.check('hello', anon)).toEqual({ kind: 'allowed', classifierDown: false });
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
