import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI, HarmBlockThreshold, HarmCategory } from '@google/genai';
import type { Content, GenerateContentConfig, Part, SafetySetting } from '@google/genai';
import { LlmUnavailableError } from './llm-provider';
import type { LlmClassifier, LlmProvider, LlmRequest, LlmResult } from './llm-provider';

function liveKey(): string | undefined {
  return process.env.GEMINI_API_KEY || undefined;
}

const API_TIMEOUT_MS = 60_000;
const RETRY_ATTEMPTS = 2;
const STRICT_SAFETY: SafetySetting[] = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
];

@Injectable()
export class GeminiProvider implements LlmProvider, LlmClassifier {
  private readonly logger = new Logger(GeminiProvider.name);

  isLive(): boolean {
    return Boolean(liveKey());
  }

  async complete(req: LlmRequest): Promise<LlmResult> {
    const ai = this.client();
    const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
    const config: GenerateContentConfig = {
      systemInstruction: req.system,
      maxOutputTokens: req.maxTokens,
    };
    if (req.temperature !== undefined) config.temperature = req.temperature;
    if (req.safety === 'strict') config.safetySettings = STRICT_SAFETY;
    try {
      const response = await ai.models.generateContent({ model, contents: this.toContents(req), config });
      const blockReason = response.promptFeedback?.blockReason;
      if (blockReason) return { text: '', blocked: { reason: String(blockReason) } };
      return { text: (response.text ?? '').trim() };
    } catch (err) {
      throw this.unavailable('generateContent', err);
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const ai = this.client();
    const model = process.env.GEMINI_EMBED_MODEL || 'gemini-embedding-2';
    try {
      const response = await ai.models.embedContent({ model, contents: texts });
      return (response.embeddings ?? []).map((embedding) => embedding.values ?? []);
    } catch (err) {
      throw this.unavailable('embedContent', err);
    }
  }

  async classify(system: string, text: string): Promise<string> {
    const ai = this.client();
    const model = process.env.GEMINI_CLASSIFIER_MODEL || 'gemini-3.1-flash-lite';
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text }] }],
        config: { systemInstruction: system, maxOutputTokens: 256, temperature: 0 },
      });
      return (response.text ?? '').trim();
    } catch (err) {
      throw this.unavailable('classify', err);
    }
  }

  private client(): GoogleGenAI {
    const apiKey = liveKey();
    if (!apiKey) throw new LlmUnavailableError('GEMINI_API_KEY is not configured');
    return new GoogleGenAI({
      apiKey,
      httpOptions: { timeout: API_TIMEOUT_MS, retryOptions: { attempts: RETRY_ATTEMPTS } },
    });
  }

  private toContents(req: LlmRequest): Content[] {
    const contents: Content[] = req.messages.map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    }));
    if (req.document) {
      const docPart: Part = { inlineData: { data: req.document.base64, mimeType: req.document.mimeType } };
      const last = contents[contents.length - 1];
      if (last && last.role === 'user' && last.parts) last.parts.push(docPart);
      else contents.push({ role: 'user', parts: [docPart] });
    }
    return contents;
  }

  private unavailable(operation: string, err: unknown): LlmUnavailableError {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.error(`Gemini ${operation} failed: ${message}`);
    return err instanceof LlmUnavailableError
      ? err
      : new LlmUnavailableError(`Gemini ${operation} failed: ${message}`);
  }
}
