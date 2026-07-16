import { PolicyIngestionService } from './policy-ingestion.service';

function setup() {
  const llm = {
    complete: jest.fn(async () => ({ text: '# Extracted\n\nPolicy body.' })),
    embed: jest.fn(async (texts: string[]) => texts.map(() => [1, 0])),
    isLive: jest.fn(() => true),
  };
  const repo = {
    replaceChunks: jest.fn(async () => undefined),
    listChunkTexts: jest.fn(async () => [
      { id: 'chunk-1', ordinal: 0, heading: 'Leave', text: 'Policy body.' },
    ]),
    setChunkEmbedding: jest.fn(async () => undefined),
    setStatus: jest.fn(async () => undefined),
  };
  return {
    llm,
    repo,
    service: new PolicyIngestionService(llm as never, repo as never),
  };
}

describe('PolicyIngestionService', () => {
  it('chunks text, embeds stored chunks, and marks the document Ready', async () => {
    const { service, llm, repo } = setup();
    await service.ingest('doc-1', { sourceType: 'text', text: '# Leave\n\nPolicy body.' });
    expect(repo.replaceChunks).toHaveBeenCalledWith('doc-1', [
      { ordinal: 0, heading: 'Leave', text: '# Leave\n\nPolicy body.' },
    ]);
    expect(llm.embed).toHaveBeenCalledWith(['Policy body.']);
    expect(repo.setChunkEmbedding).toHaveBeenCalledWith('chunk-1', [1, 0]);
    expect(repo.setStatus).toHaveBeenLastCalledWith('doc-1', 'Ready');
  });

  it('extracts PDF content using an inline PDF document', async () => {
    const { service, llm } = setup();
    await service.ingest('doc-1', { sourceType: 'pdf', base64: 'cGRm' });
    expect(llm.complete).toHaveBeenCalledWith(
      expect.objectContaining({ document: { base64: 'cGRm', mimeType: 'application/pdf' } }),
    );
  });

  it('marks the document Failed when ingestion fails', async () => {
    const { service, repo } = setup();
    repo.replaceChunks.mockRejectedValueOnce(new Error('storage failed'));
    await expect(
      service.ingest('doc-1', { sourceType: 'text', text: 'Policy body.' }),
    ).resolves.toBeUndefined();
    expect(repo.setStatus).toHaveBeenLastCalledWith('doc-1', 'Failed');
  });

  it('rejects a mismatched embedding count', async () => {
    const { service, llm, repo } = setup();
    llm.embed.mockResolvedValueOnce([]);
    await service.retryEmbedding('doc-1');
    expect(repo.setStatus).toHaveBeenLastCalledWith('doc-1', 'Failed');
  });
});
