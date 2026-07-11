import { slugify, dedupeSlug } from './slug';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Acme Corp')).toBe('acme-corp');
  });
  it('collapses runs of punctuation into a single hyphen and trims', () => {
    expect(slugify('  Foo & Bar!! ')).toBe('foo-bar');
  });
  it('falls back to "company" when nothing usable remains', () => {
    expect(slugify('!!!')).toBe('company');
  });
});

describe('dedupeSlug', () => {
  it('returns the base when free', () => {
    expect(dedupeSlug('acme', new Set())).toBe('acme');
  });
  it('appends the first free numeric suffix', () => {
    expect(dedupeSlug('acme', new Set(['acme']))).toBe('acme-2');
    expect(dedupeSlug('acme', new Set(['acme', 'acme-2']))).toBe('acme-3');
  });
});
