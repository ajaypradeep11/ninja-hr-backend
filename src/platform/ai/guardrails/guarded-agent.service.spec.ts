import type { LlmProvider } from '../llm-provider';
import { GuardedAgentService, type GuardedAskInput } from './guarded-agent.service';
import type { InputGuard, InputGuardOutcome } from './input-guard';
import type { ModerationLogService, ModerationRecord } from './moderation-log.service';
import { OutputGuard } from './output-guard';
import { refusalVerdict } from './refusals';

const input: GuardedAskInput = {
  system: 'HR assistant',
  messages: [{ role: 'user', content: 'How much leave?' }],
  persona: 'employee',
  userId: 'u1',
  otherEmployeeNames: ['Sarah Mitchell'],
};

function harness(outcome: InputGuardOutcome = { kind: 'allowed', classifierDown: false }, text = 'Four days') {
  const complete = jest.fn().mockResolvedValue({ text });
  const provider = { complete, embed: jest.fn(), isLive: () => true } as LlmProvider;
  const records: ModerationRecord[] = [];
  const moderation = { record: jest.fn(async (event: ModerationRecord) => records.push(event)) };
  const service = new GuardedAgentService(
    provider,
    { check: jest.fn().mockResolvedValue(outcome) } as unknown as InputGuard,
    new OutputGuard(),
    moderation as unknown as ModerationLogService,
  );
  return { service, complete, records };
}

describe('GuardedAgentService', () => {
  it('returns and audits input refusals without generation', async () => {
    const { service, complete, records } = harness({ kind: 'blocked', verdict: refusalVerdict('sexual') });
    expect(await service.ask(input)).toMatchObject({ verdict: { category: 'sexual' } });
    expect(complete).not.toHaveBeenCalled();
    expect(records[0]).toMatchObject({ stage: 'input', category: 'sexual' });
  });

  it('uses strict provider safety and scans output', async () => {
    const { service, complete, records } = harness(undefined, 'Sarah Mitchell has 12 days');
    expect(await service.ask(input)).toMatchObject({ verdict: { category: 'pii_leak' } });
    expect(complete.mock.calls[0][0]).toMatchObject({ safety: 'strict', maxTokens: 1024 });
    expect(complete.mock.calls[0][0].system).toMatch(/cnry_[0-9a-f]{16}/);
    expect(records[0]).toMatchObject({ stage: 'output', category: 'pii_leak' });
  });

  it('validates the final user turn', async () => {
    await expect(harness().service.ask({ ...input, messages: [{ role: 'assistant', content: 'x' }] })).rejects.toThrow('last message must be the user turn');
  });
});
