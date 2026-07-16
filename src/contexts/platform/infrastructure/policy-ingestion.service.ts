import { Inject, Injectable, Logger } from '@nestjs/common';
import { LLM_PROVIDER_CHAT, type LlmProvider } from 'src/platform/ai/llm-provider';
import { chunkPolicyText } from '../domain/policy-chunker';
import type { PolicySourceType } from '../domain/policy.types';
import { PolicyRepository } from './policy.repository';

export const PDF_EXTRACTION_PROMPT = `Extract the complete text of this employee policy handbook PDF.
Return clean markdown and nothing else — no preamble, no code fences, no commentary.
Rules:
- Preserve the document's section structure: render every section title as a markdown heading (#, ##, ### matching its nesting level in the document).
- Preserve paragraph breaks, bullet lists, and numbered lists.
- Render tables as markdown tables.
- Skip page headers, page footers, page numbers, and watermarks.
- Do not summarize, reorder, or omit any policy content.`;

const PDF_EXTRACTION_MAX_TOKENS = 32768;
export const EMBED_BATCH_SIZE = 32;

export interface PolicyIngestSource {
  sourceType: PolicySourceType;
  base64?: string;
  text?: string;
}

@Injectable()
export class PolicyIngestionService {
  private readonly logger = new Logger(PolicyIngestionService.name);

  constructor(
    @Inject(LLM_PROVIDER_CHAT) private readonly llm: LlmProvider,
    private readonly repo: PolicyRepository,
  ) {}

  async ingest(documentId: string, source: PolicyIngestSource): Promise<void> {
    try {
      const markdown =
        source.sourceType === 'pdf'
          ? await this.extractPdfText(source.base64 ?? '')
          : (source.text ?? '');
      const drafts = chunkPolicyText(markdown);
      if (drafts.length === 0) throw new Error('no text could be extracted from the document');
      await this.repo.replaceChunks(documentId, drafts);
      await this.embedStoredChunks(documentId);
      await this.repo.setStatus(documentId, 'Ready');
    } catch (error) {
      this.logger.error(
        `policy ingestion failed for ${documentId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      await this.repo.setStatus(documentId, 'Failed').catch(() => undefined);
    }
  }

  async retryEmbedding(documentId: string): Promise<void> {
    try {
      await this.embedStoredChunks(documentId);
      await this.repo.setStatus(documentId, 'Ready');
    } catch (error) {
      this.logger.error(
        `policy re-embedding failed for ${documentId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      await this.repo.setStatus(documentId, 'Failed').catch(() => undefined);
    }
  }

  private async embedStoredChunks(documentId: string): Promise<void> {
    const chunks = await this.repo.listChunkTexts(documentId);
    for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
      const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
      const vectors = await this.llm.embed(batch.map((chunk) => chunk.text));
      if (vectors.length !== batch.length) {
        throw new Error(`embed returned ${vectors.length} vectors for ${batch.length} texts`);
      }
      for (let j = 0; j < batch.length; j++) {
        await this.repo.setChunkEmbedding(batch[j].id, vectors[j]);
      }
    }
  }

  private async extractPdfText(base64: string): Promise<string> {
    const result = await this.llm.complete({
      system: 'You are a precise document-to-markdown extraction engine.',
      messages: [{ role: 'user', content: PDF_EXTRACTION_PROMPT }],
      maxTokens: PDF_EXTRACTION_MAX_TOKENS,
      document: { base64, mimeType: 'application/pdf' },
    });
    if (result.blocked)
      throw new Error(`provider blocked PDF extraction: ${result.blocked.reason}`);
    return result.text;
  }
}
