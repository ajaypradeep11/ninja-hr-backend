/**
 * URL-safe slug from a free-text name: lowercased, non-alphanumerics collapsed to
 * single hyphens, trimmed. Falls back to "company" when the name has no usable
 * characters (e.g. all punctuation) so we never produce an empty slug.
 */
export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'company';
}

/**
 * Given the base slug and the set of slugs already taken, return the first free
 * variant: base, then base-2, base-3, … Deterministic (no randomness) so signup
 * stays testable; the DB's unique constraint on Company.slug is the final guard.
 */
export function dedupeSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
