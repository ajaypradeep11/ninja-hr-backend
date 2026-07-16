import { PolicyRetrievalService } from './policy-retrieval.service';

function setup(live = true) {
  const llm = {
    complete: jest.fn(),
    embed: jest.fn(async () => [[1, 0]]),
    isLive: jest.fn(() => live),
  };
  const repo = {
    listReadyChunks: jest.fn(async () => [
      {
        ordinal: 2,
        heading: 'Vacation',
        text: 'Employees receive vacation.',
        embedding: [1, 0],
        documentTitle: 'Handbook',
      },
      {
        ordinal: 3,
        heading: 'Conduct',
        text: 'Unrelated.',
        embedding: [0, 1],
        documentTitle: 'Handbook',
      },
    ]),
  };
  return { llm, repo, service: new PolicyRetrievalService(llm as never, repo as never) };
}

describe('PolicyRetrievalService', () => {
  it('returns top excerpts above the similarity floor', async () => {
    const { service } = setup();
    await expect(service.retrieve('How much vacation?')).resolves.toEqual([
      {
        title: 'Handbook',
        heading: 'Vacation',
        ordinal: 2,
        text: 'Employees receive vacation.',
      },
    ]);
  });

  it('returns no excerpts when AI is not live', async () => {
    const { service, repo, llm } = setup(false);
    await expect(service.retrieve('question')).resolves.toEqual([]);
    expect(repo.listReadyChunks).not.toHaveBeenCalled();
    expect(llm.embed).not.toHaveBeenCalled();
  });

  it('fails softly when embedding fails', async () => {
    const { service, llm } = setup();
    llm.embed.mockRejectedValueOnce(new Error('provider unavailable'));
    await expect(service.retrieve('question')).resolves.toEqual([]);
  });
});
