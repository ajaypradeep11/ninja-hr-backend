import { Test } from '@nestjs/testing';
import { AiModule, resolveChatProvider } from './ai.module';
import { AnthropicProvider } from './anthropic.provider';
import { GeminiProvider } from './gemini.provider';
import { LLM_CLASSIFIER, LLM_PROVIDER_CHAT } from './llm-provider';

describe('AiModule provider selection', () => {
  let savedChoice: string | undefined;
  const gemini = new GeminiProvider();
  const anthropic = new AnthropicProvider();

  beforeEach(() => {
    savedChoice = process.env.AI_PROVIDER_CHAT;
    delete process.env.AI_PROVIDER_CHAT;
  });

  afterEach(() => {
    if (savedChoice === undefined) delete process.env.AI_PROVIDER_CHAT;
    else process.env.AI_PROVIDER_CHAT = savedChoice;
  });

  it('defaults to Gemini', () => expect(resolveChatProvider(gemini, anthropic)).toBe(gemini));

  it('selects Anthropic case and whitespace insensitively', () => {
    process.env.AI_PROVIDER_CHAT = ' Anthropic ';
    expect(resolveChatProvider(gemini, anthropic)).toBe(anthropic);
  });

  it('falls back to Gemini for unknown values', () => {
    process.env.AI_PROVIDER_CHAT = 'openai';
    expect(resolveChatProvider(gemini, anthropic)).toBe(gemini);
  });

  it('wires provider and classifier tokens through Nest DI', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AiModule] }).compile();
    expect(moduleRef.get(LLM_PROVIDER_CHAT)).toBeInstanceOf(GeminiProvider);
    expect(moduleRef.get(LLM_CLASSIFIER)).toBe(moduleRef.get(GeminiProvider));
  });
});
