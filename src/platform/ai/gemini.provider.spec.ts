import { Logger } from '@nestjs/common';
import { GeminiProvider } from './gemini.provider';
import { LlmUnavailableError } from './llm-provider';
import type { LlmRequest } from './llm-provider';

const mockGenerateContent = jest.fn();
const mockEmbedContent = jest.fn();
const mockGoogleGenAI = jest.fn().mockImplementation(() => ({
  models: { generateContent: mockGenerateContent, embedContent: mockEmbedContent },
}));

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation((...args: unknown[]) => mockGoogleGenAI(...args)),
  HarmCategory: {
    HARM_CATEGORY_HARASSMENT: 'HARM_CATEGORY_HARASSMENT',
    HARM_CATEGORY_HATE_SPEECH: 'HARM_CATEGORY_HATE_SPEECH',
    HARM_CATEGORY_SEXUALLY_EXPLICIT: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    HARM_CATEGORY_DANGEROUS_CONTENT: 'HARM_CATEGORY_DANGEROUS_CONTENT',
  },
  HarmBlockThreshold: { BLOCK_LOW_AND_ABOVE: 'BLOCK_LOW_AND_ABOVE' },
}));

const ENV_KEYS = ['GEMINI_API_KEY', 'GEMINI_MODEL', 'GEMINI_CLASSIFIER_MODEL', 'GEMINI_EMBED_MODEL'] as const;

describe('GeminiProvider', () => {
  const saved: Record<string, string | undefined> = {};
  let provider: GeminiProvider;
  let errorLog: jest.SpyInstance;
  const baseReq = (over: Partial<LlmRequest> = {}): LlmRequest => ({
    system: 'You are the HR assistant.',
    messages: [{ role: 'user', content: 'How much leave do I have?' }],
    maxTokens: 4096,
    ...over,
  });

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    mockGenerateContent.mockReset();
    mockEmbedContent.mockReset();
    mockGoogleGenAI.mockClear();
    errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    provider = new GeminiProvider();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    errorLog.mockRestore();
  });

  it('reads liveness from the environment at call time', () => {
    expect(provider.isLive()).toBe(false);
    process.env.GEMINI_API_KEY = 'k-late';
    expect(provider.isLive()).toBe(true);
  });

  describe('complete', () => {
    it('rejects without a key without touching the SDK', async () => {
      await expect(provider.complete(baseReq())).rejects.toBeInstanceOf(LlmUnavailableError);
      expect(mockGoogleGenAI).not.toHaveBeenCalled();
    });

    it('uses the call-time key, timeout, and retry bound', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      mockGenerateContent.mockResolvedValue({ text: 'ok' });
      await provider.complete(baseReq());
      expect(mockGoogleGenAI).toHaveBeenCalledWith({
        apiKey: 'test-key',
        httpOptions: { timeout: 60_000, retryOptions: { attempts: 2 } },
      });
    });

    it('maps messages and generation config', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      mockGenerateContent.mockResolvedValue({ text: '  answer  ' });
      const result = await provider.complete(baseReq({
        messages: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hello' }],
        temperature: 0.3,
      }));
      expect(mockGenerateContent).toHaveBeenCalledWith({
        model: 'gemini-3.5-flash',
        contents: [
          { role: 'user', parts: [{ text: 'hi' }] },
          { role: 'model', parts: [{ text: 'hello' }] },
        ],
        config: { systemInstruction: 'You are the HR assistant.', maxOutputTokens: 4096, temperature: 0.3 },
      });
      expect(result).toEqual({ text: 'answer' });
    });

    it('honors the model override', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      process.env.GEMINI_MODEL = 'gemini-9-experimental';
      mockGenerateContent.mockResolvedValue({ text: 'ok' });
      await provider.complete(baseReq());
      expect(mockGenerateContent).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemini-9-experimental' }));
    });

    it('maps strict safety across four harm categories', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      mockGenerateContent.mockResolvedValue({ text: 'ok' });
      await provider.complete(baseReq({ safety: 'strict' }));
      expect(mockGenerateContent.mock.calls[0][0].config.safetySettings).toEqual([
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_LOW_AND_ABOVE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
      ]);
    });

    it('omits default safety settings', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      mockGenerateContent.mockResolvedValue({ text: 'ok' });
      await provider.complete(baseReq({ safety: 'default' }));
      expect(mockGenerateContent.mock.calls[0][0].config).not.toHaveProperty('safetySettings');
    });

    it('appends inline documents to the last user turn', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      mockGenerateContent.mockResolvedValue({ text: 'extracted' });
      await provider.complete(baseReq({ document: { base64: 'AAECAw==', mimeType: 'application/pdf' } }));
      expect(mockGenerateContent.mock.calls[0][0].contents[0].parts).toEqual([
        { text: 'How much leave do I have?' },
        { inlineData: { data: 'AAECAw==', mimeType: 'application/pdf' } },
      ]);
    });

    it('maps provider blocks without throwing', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      mockGenerateContent.mockResolvedValue({ promptFeedback: { blockReason: 'SAFETY' } });
      await expect(provider.complete(baseReq())).resolves.toEqual({ text: '', blocked: { reason: 'SAFETY' } });
    });

    it('logs SDK failures and degrades to LlmUnavailableError', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      mockGenerateContent.mockRejectedValue(new Error('429 rate limited'));
      await expect(provider.complete(baseReq())).rejects.toBeInstanceOf(LlmUnavailableError);
      expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('429 rate limited'));
    });

    it('returns empty text when the model returns no text and is not blocked', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      mockGenerateContent.mockResolvedValue({ text: undefined });
      await expect(provider.complete(baseReq())).resolves.toEqual({ text: '' });
    });
  });

  describe('embed', () => {
    it('rejects without a key', async () => {
      await expect(provider.embed(['x'])).rejects.toBeInstanceOf(LlmUnavailableError);
      expect(mockEmbedContent).not.toHaveBeenCalled();
    });

    it('short-circuits empty input', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      await expect(provider.embed([])).resolves.toEqual([]);
      expect(mockEmbedContent).not.toHaveBeenCalled();
    });

    it('returns vectors in order and honors the default model', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      mockEmbedContent.mockResolvedValue({ embeddings: [{ values: [0.1] }, { values: [0.2] }] });
      await expect(provider.embed(['one', 'two'])).resolves.toEqual([[0.1], [0.2]]);
      expect(mockEmbedContent).toHaveBeenCalledWith({ model: 'gemini-embedding-2', contents: ['one', 'two'] });
    });

    it('honors the embedding model override', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      process.env.GEMINI_EMBED_MODEL = 'gemini-embedding-9';
      mockEmbedContent.mockResolvedValue({ embeddings: [{ values: [1] }] });
      await provider.embed(['x']);
      expect(mockEmbedContent).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemini-embedding-9' }));
    });

    it('logs embedding failures', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      mockEmbedContent.mockRejectedValue(new Error('503 unavailable'));
      await expect(provider.embed(['x'])).rejects.toBeInstanceOf(LlmUnavailableError);
      expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('503 unavailable'));
    });
  });

  describe('classify', () => {
    it('rejects without a key', async () => {
      await expect(provider.classify('system', 'message')).rejects.toBeInstanceOf(LlmUnavailableError);
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('uses the classifier model deterministically', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      mockGenerateContent.mockResolvedValue({ text: ' allowed ' });
      await expect(provider.classify('system', 'message')).resolves.toBe('allowed');
      expect(mockGenerateContent).toHaveBeenCalledWith({
        model: 'gemini-3.1-flash-lite',
        contents: [{ role: 'user', parts: [{ text: 'message' }] }],
        config: { systemInstruction: 'system', maxOutputTokens: 256, temperature: 0 },
      });
    });

    it('honors the classifier model override', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      process.env.GEMINI_CLASSIFIER_MODEL = 'gemini-lite-9';
      mockGenerateContent.mockResolvedValue({ text: 'allowed' });
      await provider.classify('system', 'message');
      expect(mockGenerateContent).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemini-lite-9' }));
    });

    it('logs and wraps classifier failures', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      mockGenerateContent.mockRejectedValue(new Error('timeout'));
      await expect(provider.classify('system', 'message')).rejects.toBeInstanceOf(LlmUnavailableError);
      expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('timeout'));
    });
  });
});
