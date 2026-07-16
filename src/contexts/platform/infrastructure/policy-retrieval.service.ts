import { Inject, Injectable, Logger } from '@nestjs/common';
import { LLM_PROVIDER_CHAT, type LlmProvider } from 'src/platform/ai/llm-provider';
import { topKBySimilarity } from '../domain/cosine';
import type { PolicyExcerpt } from '../domain/policy.types';
import { PolicyRepository } from './policy.repository';

export const RETRIEVAL_TOP_K = 5;
export const RETRIEVAL_SCORE_FLOOR = 0.5;

@Injectable()
export class PolicyRetrievalService {
  private readonly logger = new Logger(PolicyRetrievalService.name);

  constructor(
    @Inject(LLM_PROVIDER_CHAT) private readonly llm: LlmProvider,
    private readonly repo: PolicyRepository,
  ) {}

  async retrieve(question: string): Promise<PolicyExcerpt[]> {
    if (!this.llm.isLive()) return [];
    try {
      const chunks = await this.repo.listReadyChunks();
      if (chunks.length === 0) return [];
      const [queryVector] = await this.llm.embed([question]);
      if (!queryVector) return [];
      return topKBySimilarity(
        queryVector,
        chunks,
        (chunk) => chunk.embedding,
        RETRIEVAL_TOP_K,
        RETRIEVAL_SCORE_FLOOR,
      ).map(({ item }) => ({
        title: item.documentTitle,
        heading: item.heading,
        ordinal: item.ordinal,
        text: item.text,
      }));
    } catch (error) {
      this.logger.error(
        `policy retrieval failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }
}
