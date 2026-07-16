import { BadRequestException, Inject, Logger, ServiceUnavailableException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { LLM_PROVIDER_CHAT, type LlmProvider } from 'src/platform/ai/llm-provider';
import { TenantContext } from 'src/platform/database/tenant-context';
import {
  AI_NOT_CONFIGURED_MESSAGE,
  type PolicyDocumentSummary,
  type PolicySourceType,
} from '../../domain/policy.types';
import { PolicyIngestionService } from '../../infrastructure/policy-ingestion.service';
import { PolicyRepository } from '../../infrastructure/policy.repository';

export interface UploadPolicyDocumentInput {
  title: string;
  sourceType: PolicySourceType;
  base64?: string;
  text?: string;
}

export class UploadPolicyDocumentCommand {
  constructor(public readonly input: UploadPolicyDocumentInput) {}
}

@CommandHandler(UploadPolicyDocumentCommand)
export class UploadPolicyDocumentHandler implements ICommandHandler<
  UploadPolicyDocumentCommand,
  PolicyDocumentSummary[]
> {
  private readonly logger = new Logger(UploadPolicyDocumentHandler.name);

  constructor(
    private readonly repo: PolicyRepository,
    private readonly ingestion: PolicyIngestionService,
    private readonly tenant: TenantContext,
    @Inject(LLM_PROVIDER_CHAT) private readonly llm: LlmProvider,
  ) {}

  async execute({ input }: UploadPolicyDocumentCommand): Promise<PolicyDocumentSummary[]> {
    if (input.sourceType === 'pdf' && !input.base64) {
      throw new BadRequestException('base64 is required when sourceType is "pdf"');
    }
    if (input.sourceType === 'text' && !input.text?.trim()) {
      throw new BadRequestException('text is required when sourceType is "text"');
    }
    if (!this.llm.isLive()) throw new ServiceUnavailableException(AI_NOT_CONFIGURED_MESSAGE);

    await this.repo.deleteAllDocuments();
    const { id } = await this.repo.createDocument({
      title: input.title,
      sourceType: input.sourceType,
    });

    const companyId = this.tenant.companyId;
    void Promise.resolve(this.tenant.run(companyId, () => this.ingestion.ingest(id, input))).catch(
      (error) =>
        this.logger.error(
          `policy ingestion crashed for ${id}: ${error instanceof Error ? error.message : String(error)}`,
        ),
    );
    return this.repo.listDocuments();
  }
}
