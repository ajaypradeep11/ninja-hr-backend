// src/contexts/recruitment/domain/inclusive-language.service.ts
// Rule-based inclusive-language flags (deterministic; no AI). Mirrors the
// frontend lib/inclusive-language.ts and is used as a guardrail on AI-generated
// JDs. Pure function → spec-tested.

export type InclusiveCategory =
  | 'gendered'
  | 'ageist'
  | 'ableist'
  | 'jargon'
  | 'masculine-coded'
  | 'exclusionary';

export interface InclusiveFlag {
  term: string;
  category: InclusiveCategory;
  suggestion: string;
}

interface Rule {
  pattern: RegExp;
  category: InclusiveCategory;
  suggestion: string;
}

const RULES: Rule[] = [
  { pattern: /\b(he\/she|s\/he|his\/her|him\/her)\b/gi, category: 'gendered', suggestion: 'use "they/their"' },
  { pattern: /\bchairman\b/gi, category: 'gendered', suggestion: '"chair" or "chairperson"' },
  { pattern: /\bsales ?man\b/gi, category: 'gendered', suggestion: '"salesperson"' },
  { pattern: /\bmanpower\b/gi, category: 'gendered', suggestion: '"workforce"' },
  { pattern: /\bguys\b/gi, category: 'gendered', suggestion: '"team" or "folks"' },
  { pattern: /\byoung\b/gi, category: 'ageist', suggestion: 'focus on skills, not age' },
  { pattern: /\benergetic\b/gi, category: 'ageist', suggestion: '"motivated"' },
  { pattern: /\bdigital native\b/gi, category: 'ageist', suggestion: '"comfortable with digital tools"' },
  { pattern: /\bcrazy\b/gi, category: 'ableist', suggestion: '"exciting"' },
  { pattern: /\bsanity check\b/gi, category: 'ableist', suggestion: '"quick check"' },
  { pattern: /\brock ?star\b/gi, category: 'jargon', suggestion: '"skilled" or "high-performing"' },
  { pattern: /\bninja\b/gi, category: 'jargon', suggestion: '"expert"' },
  { pattern: /\bguru\b/gi, category: 'jargon', suggestion: '"expert"' },
  { pattern: /\baggressive\b/gi, category: 'masculine-coded', suggestion: '"proactive"' },
  { pattern: /\bdominant\b/gi, category: 'masculine-coded', suggestion: '"leading"' },
  { pattern: /\bnative (english )?speaker\b/gi, category: 'exclusionary', suggestion: '"fluent in English"' },
];

export function checkInclusiveLanguage(text: string): InclusiveFlag[] {
  if (!text) return [];
  const found = new Map<string, InclusiveFlag>();
  for (const rule of RULES) {
    const matches = text.match(rule.pattern);
    if (matches) {
      for (const m of matches) {
        const key = m.toLowerCase();
        if (!found.has(key)) {
          found.set(key, { term: m, category: rule.category, suggestion: rule.suggestion });
        }
      }
    }
  }
  return [...found.values()];
}
