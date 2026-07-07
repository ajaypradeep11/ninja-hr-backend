// src/contexts/recruitment/domain/inclusive-language.service.spec.ts
import { checkInclusiveLanguage } from './inclusive-language.service';

describe('checkInclusiveLanguage', () => {
  it('flags exclusionary jargon with a suggestion', () => {
    const flags = checkInclusiveLanguage('We need a coding ninja and a sales rockstar.');
    const terms = flags.map((f) => f.term.toLowerCase());
    expect(terms).toContain('ninja');
    expect(terms).toContain('rockstar');
    expect(flags.find((f) => f.term.toLowerCase() === 'ninja')?.category).toBe('jargon');
  });

  it('flags gendered, ageist and masculine-coded wording', () => {
    const flags = checkInclusiveLanguage('A young, energetic, aggressive chairman who is his/her own boss.');
    const cats = new Set(flags.map((f) => f.category));
    expect(cats.has('ageist')).toBe(true);
    expect(cats.has('masculine-coded')).toBe(true);
    expect(cats.has('gendered')).toBe(true);
  });

  it('is case-insensitive and de-duplicates repeated terms', () => {
    const flags = checkInclusiveLanguage('Ninja ninja NINJA');
    expect(flags.filter((f) => f.term.toLowerCase() === 'ninja')).toHaveLength(1);
  });

  it('returns nothing for inclusive text', () => {
    expect(checkInclusiveLanguage('We seek a motivated, skilled professional fluent in English.')).toHaveLength(0);
  });

  it('handles empty input', () => {
    expect(checkInclusiveLanguage('')).toEqual([]);
  });
});
