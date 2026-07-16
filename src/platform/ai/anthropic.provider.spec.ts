import { Logger } from '@nestjs/common';
import { AnthropicProvider } from './anthropic.provider';
import { LlmUnavailableError } from './llm-provider';
import type { LlmRequest } from './llm-provider';

const mockCreate = jest.fn();
const mockAnthropic = jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } }));
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation((...args: unknown[]) => mockAnthropic(...args)),
}));

describe('AnthropicProvider', () => {
  let savedKey: string | undefined;
  let provider: AnthropicProvider;
  let errorLog: jest.SpyInstance;
  const request = (over: Partial<LlmRequest> = {}): LlmRequest => ({
    system: 'HR assistant', messages: [{ role: 'user', content: 'hi' }], maxTokens: 1024, ...over,
  });

  beforeEach(() => {
    savedKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    mockCreate.mockReset();
    mockAnthropic.mockClear();
    errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    provider = new AnthropicProvider();
  });

  afterEach(() => {
    if (savedKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = savedKey;
    errorLog.mockRestore();
  });

  it('reads liveness at call time', () => {
    expect(provider.isLive()).toBe(false);
    process.env.ANTHROPIC_API_KEY = 'late';
    expect(provider.isLive()).toBe(true);
  });

  it('rejects without a key', async () => {
    await expect(provider.complete(request())).rejects.toBeInstanceOf(LlmUnavailableError);
    expect(mockAnthropic).not.toHaveBeenCalled();
  });

  it('maps requests and joins text blocks', async () => {
    process.env.ANTHROPIC_API_KEY = 'key';
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'Hello ' }, { type: 'text', text: 'there.' }] });
    await expect(provider.complete(request({ temperature: 0.5 }))).resolves.toEqual({ text: 'Hello there.' });
    expect(mockAnthropic).toHaveBeenCalledWith({ apiKey: 'key', timeout: 60_000, maxRetries: 1 });
    expect(mockCreate).toHaveBeenCalledWith({
      model: 'claude-opus-4-8', max_tokens: 1024, temperature: 0.5, system: 'HR assistant',
      messages: [{ role: 'user', content: 'hi' }],
    });
  });

  it('rejects inline documents', async () => {
    process.env.ANTHROPIC_API_KEY = 'key';
    await expect(provider.complete(request({ document: { base64: 'AA', mimeType: 'application/pdf' } })))
      .rejects.toBeInstanceOf(LlmUnavailableError);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('logs and wraps SDK failures', async () => {
    process.env.ANTHROPIC_API_KEY = 'key';
    mockCreate.mockRejectedValue(new Error('overloaded'));
    await expect(provider.complete(request())).rejects.toBeInstanceOf(LlmUnavailableError);
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('overloaded'));
  });

  it('does not implement embeddings', async () => {
    await expect(provider.embed(['x'])).rejects.toThrow(/Not implemented/);
  });
});
