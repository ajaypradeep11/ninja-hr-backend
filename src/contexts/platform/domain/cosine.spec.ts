import { cosineSimilarity, topKBySimilarity } from './cosine';

describe('cosine helpers', () => {
  it('computes identical, orthogonal, and opposite vectors', () => {
    expect(cosineSimilarity([1, 2], [1, 2])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it('returns zero for invalid or zero vectors', () => {
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([1], [1, 2])).toBe(0);
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
  });

  it('orders matches, applies the floor, and limits results', () => {
    const items = [
      { id: 'best', vector: [1, 0] },
      { id: 'second', vector: [0.8, 0.2] },
      { id: 'low', vector: [0, 1] },
    ];
    expect(topKBySimilarity([1, 0], items, (item) => item.vector, 2, 0.5)).toEqual([
      { item: items[0], score: 1 },
      { item: items[1], score: expect.any(Number) },
    ]);
  });
});
