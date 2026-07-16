import { Module } from '@nestjs/common';
import { AnthropicProvider } from './anthropic.provider';
import { GeminiProvider } from './gemini.provider';
import { LLM_CLASSIFIER, LLM_PROVIDER_CHAT } from './llm-provider';
import type { LlmProvider } from './llm-provider';
import { GuardedAgentService } from './guardrails/guarded-agent.service';
import { InputGuard } from './guardrails/input-guard';
import { ModerationLogService } from './guardrails/moderation-log.service';
import { OutputGuard } from './guardrails/output-guard';
import { SlidingWindowRateLimiter } from './guardrails/rate-limiter';

export function resolveChatProvider(gemini: GeminiProvider, anthropic: AnthropicProvider): LlmProvider {
  const choice = (process.env.AI_PROVIDER_CHAT || 'gemini').trim().toLowerCase();
  return choice === 'anthropic' ? anthropic : gemini;
}

@Module({
  providers: [
    GeminiProvider,
    AnthropicProvider,
    { provide: LLM_PROVIDER_CHAT, useFactory: resolveChatProvider, inject: [GeminiProvider, AnthropicProvider] },
    { provide: LLM_CLASSIFIER, useExisting: GeminiProvider },
    { provide: SlidingWindowRateLimiter, useFactory: () => new SlidingWindowRateLimiter() },
    InputGuard,
    OutputGuard,
    ModerationLogService,
    GuardedAgentService,
  ],
  exports: [LLM_PROVIDER_CHAT, LLM_CLASSIFIER, GeminiProvider, GuardedAgentService],
})
export class AiModule {}
