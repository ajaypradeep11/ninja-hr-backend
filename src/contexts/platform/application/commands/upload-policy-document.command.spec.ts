import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import {
  UploadPolicyDocumentCommand,
  UploadPolicyDocumentHandler,
} from './upload-policy-document.command';

function setup(live = true) {
  const repo = {
    deleteAllDocuments: jest.fn(async () => undefined),
    createDocument: jest.fn(async () => ({ id: 'doc-1' })),
    listDocuments: jest.fn(async () => [{ id: 'doc-1', status: 'Processing' }]),
  };
  const ingestion = { ingest: jest.fn(async () => undefined) };
  const tenant = {
    companyId: 'company-1',
    run: jest.fn((_: string | null, work: () => unknown) => work()),
  };
  const llm = { complete: jest.fn(), embed: jest.fn(), isLive: jest.fn(() => live) };
  return {
    repo,
    ingestion,
    tenant,
    handler: new UploadPolicyDocumentHandler(
      repo as never,
      ingestion as never,
      tenant as never,
      llm as never,
    ),
  };
}

describe('UploadPolicyDocumentHandler', () => {
  it.each([
    { title: 'Manual', sourceType: 'text' as const },
    { title: 'Manual', sourceType: 'pdf' as const },
  ])('rejects incomplete input', async (input) => {
    const { handler } = setup();
    await expect(handler.execute(new UploadPolicyDocumentCommand(input))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuses ingestion before replacing data when AI is not live', async () => {
    const { handler, repo } = setup(false);
    await expect(
      handler.execute(
        new UploadPolicyDocumentCommand({ title: 'Manual', sourceType: 'text', text: 'Body' }),
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(repo.deleteAllDocuments).not.toHaveBeenCalled();
  });

  it('replaces the document and launches ingestion in tenant scope', async () => {
    const { handler, repo, ingestion, tenant } = setup();
    const input = { title: 'Manual', sourceType: 'text' as const, text: 'Body' };
    await expect(handler.execute(new UploadPolicyDocumentCommand(input))).resolves.toEqual([
      { id: 'doc-1', status: 'Processing' },
    ]);
    expect(repo.createDocument).toHaveBeenCalledWith({ title: 'Manual', sourceType: 'text' });
    expect(tenant.run).toHaveBeenCalledWith('company-1', expect.any(Function));
    expect(ingestion.ingest).toHaveBeenCalledWith('doc-1', input);
  });
});
