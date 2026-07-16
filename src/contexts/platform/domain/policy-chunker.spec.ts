import { chunkPolicyText } from './policy-chunker';

const para = (sentence: string, count: number) =>
  Array.from({ length: count }, () => sentence).join(' ');

describe('chunkPolicyText', () => {
  it('returns no chunks for blank input', () => {
    expect(chunkPolicyText('')).toEqual([]);
    expect(chunkPolicyText('  \n\n ')).toEqual([]);
  });

  it('keeps a small headed document in one chunk', () => {
    expect(chunkPolicyText('# Leave\n\nEmployees get 15 vacation days.')).toEqual([
      {
        ordinal: 0,
        heading: 'Leave',
        text: '# Leave\n\nEmployees get 15 vacation days.',
      },
    ]);
  });

  it('assigns sequential ordinals and exact overlap', () => {
    const document = Array.from({ length: 10 }, (_, index) =>
      para(`Paragraph ${index} text.`, 30),
    ).join('\n\n');
    const chunks = chunkPolicyText(document);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map(({ ordinal }) => ordinal)).toEqual(chunks.map((_, index) => index));
    for (let index = 1; index < chunks.length; index++) {
      expect(chunks[index].text.startsWith(chunks[index - 1].text.slice(-200))).toBe(true);
    }
  });

  it('tracks the nearest markdown heading', () => {
    const document = [
      '# Vacation',
      para('Vacation policy sentence.', 60),
      '# Sick Leave',
      para('Sick leave policy sentence.', 60),
    ].join('\n\n');
    const chunks = chunkPolicyText(document);
    expect(chunks.some(({ heading }) => heading === 'Vacation')).toBe(true);
    expect(
      chunks.some(
        ({ heading, text }) =>
          heading === 'Sick Leave' && text.includes('Sick leave policy sentence.'),
      ),
    ).toBe(true);
  });

  it('hard-splits an oversized paragraph into bounded chunks', () => {
    const chunks = chunkPolicyText('x'.repeat(5000));
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(({ text, heading }) => text.length <= 1702 && heading === null)).toBe(true);
  });

  it('honours custom chunk options', () => {
    const document = Array.from({ length: 6 }, (_, index) => para(`Sentence ${index}.`, 10)).join(
      '\n\n',
    );
    const chunks = chunkPolicyText(document, { targetChars: 200, overlapChars: 40 });
    expect(chunks.length).toBeGreaterThan(1);
    for (let index = 1; index < chunks.length; index++) {
      expect(chunks[index].text.startsWith(chunks[index - 1].text.slice(-40))).toBe(true);
    }
  });
});
