import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  RetryPolicyIngestionCommand,
  RetryPolicyIngestionHandler,
} from './retry-policy-ingestion.command';

function setup(
  options: {
    status?: 'Processing' | 'Ready' | 'Failed';
    exists?: boolean;
    chunks?: number;
    live?: boolean;
  } = {},
) {
  const repo = {
    getDocument: jest.fn(async () =>
      options.exists === false ? null : { id: 'doc-1', status: options.status ?? 'Failed' },
    ),
    countChunks: jest.fn(async () => options.chunks ?? 1),
    setStatus: jest.fn(async () => undefined),
    listDocuments: jest.fn(async () => []),
  };
  const ingestion = { retryEmbedding: jest.fn(async () => undefined) };
  const tenant = {
    companyId: 'company-1',
    run: jest.fn((_: string | null, work: () => unknown) => work()),
  };
  const llm = {
    complete: jest.fn(),
    embed: jest.fn(),
    isLive: jest.fn(() => options.live ?? true),
  };
  return {
    repo,
    ingestion,
    tenant,
    handler: new RetryPolicyIngestionHandler(
      repo as never,
      ingestion as never,
      tenant as never,
      llm as never,
    ),
  };
}

describe('RetryPolicyIngestionHandler', () => {
  it('rejects unknown and non-failed documents', async () => {
    await expect(
      setup({ exists: false }).handler.execute(new RetryPolicyIngestionCommand('missing')),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      setup({ status: 'Ready' }).handler.execute(new RetryPolicyIngestionCommand('doc-1')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a retry without stored chunks or live AI', async () => {
    await expect(
      setup({ chunks: 0 }).handler.execute(new RetryPolicyIngestionCommand('doc-1')),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      setup({ live: false }).handler.execute(new RetryPolicyIngestionCommand('doc-1')),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('sets Processing and launches re-embedding in tenant scope', async () => {
    const { handler, repo, ingestion, tenant } = setup();
    await handler.execute(new RetryPolicyIngestionCommand('doc-1'));
    expect(repo.setStatus).toHaveBeenCalledWith('doc-1', 'Processing');
    expect(tenant.run).toHaveBeenCalledWith('company-1', expect.any(Function));
    expect(ingestion.retryEmbedding).toHaveBeenCalledWith('doc-1');
  });
});
