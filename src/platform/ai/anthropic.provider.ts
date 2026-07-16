import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { LlmUnavailableError } from './llm-provider';
import type { LlmProvider, LlmRequest, LlmResult } from './llm-provider';

function liveKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY || undefined;
}

const API_TIMEOUT_MS = 60_000;
const MODEL = 'claude-opus-4-8';

@Injectable()
export class AnthropicProvider implements LlmProvider {
  private readonly logger = new Logger(AnthropicProvider.name);

  isLive(): boolean {
    return Boolean(liveKey());
  }

  async complete(req: LlmRequest): Promise<LlmResult> {
    const apiKey = liveKey();
    if (!apiKey) throw new LlmUnavailableError('ANTHROPIC_API_KEY is not configured');
    if (req.document) throw new LlmUnavailableError('AnthropicProvider does not support inline documents');
    try {
      const client = new Anthropic({ apiKey, timeout: API_TIMEOUT_MS, maxRetries: 1 });
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: req.maxTokens,
        ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
        system: req.system,
        messages: req.messages.map((message) => ({ role: message.role, content: message.content })),
      });
      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('')
        .trim();
      return { text };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Anthropic API call failed: ${message}`);
      throw new LlmUnavailableError(`Anthropic API call failed: ${message}`);
    }
  }

  embed(texts: string[]): Promise<number[][]> {
    void texts;
    return Promise.reject(new Error('Not implemented: AnthropicProvider.embed — embeddings run on the Gemini provider'));
  }
}
