import {
  BadRequestException,
  Inject,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { LLM_PROVIDER_CHAT, type LlmProvider } from 'src/platform/ai/llm-provider';
import { TenantContext } from 'src/platform/database/tenant-context';
import { AI_NOT_CONFIGURED_MESSAGE, type PolicyDocumentSummary } from '../../domain/policy.types';
import { PolicyIngestionService } from '../../infrastructure/policy-ingestion.service';
import { PolicyRepository } from '../../infrastructure/policy.repository';

export class RetryPolicyIngestionCommand {
  constructor(public readonly id: string) {}
}

@CommandHandler(RetryPolicyIngestionCommand)
export class RetryPolicyIngestionHandler implements ICommandHandler<
  RetryPolicyIngestionCommand,
  PolicyDocumentSummary[]
> {
  private readonly logger = new Logger(RetryPolicyIngestionHandler.name);

  constructor(
    private readonly repo: PolicyRepository,
    private readonly ingestion: PolicyIngestionService,
    private readonly tenant: TenantContext,
    @Inject(LLM_PROVIDER_CHAT) private readonly llm: LlmProvider,
  ) {}

  async execute({ id }: RetryPolicyIngestionCommand): Promise<PolicyDocumentSummary[]> {
    const document = await this.repo.getDocument(id);
    if (!document) throw new NotFoundException('Policy document not found');
    if (document.status !== 'Failed') {
      throw new BadRequestException('Only a Failed document can be retried.');
    }
    if ((await this.repo.countChunks(id)) === 0) {
      throw new BadRequestException('The original file is not stored — upload the handbook again.');
    }
    if (!this.llm.isLive()) throw new ServiceUnavailableException(AI_NOT_CONFIGURED_MESSAGE);

    await this.repo.setStatus(id, 'Processing');
    const companyId = this.tenant.companyId;
    void Promise.resolve(this.tenant.run(companyId, () => this.ingestion.retryEmbedding(id))).catch(
      (error) =>
        this.logger.error(
          `policy retry crashed for ${id}: ${error instanceof Error ? error.message : String(error)}`,
        ),
    );
    return this.repo.listDocuments();
  }
}
