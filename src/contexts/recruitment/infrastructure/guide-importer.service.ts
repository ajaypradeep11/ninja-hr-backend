// src/contexts/recruitment/infrastructure/guide-importer.service.ts
// Imports an EXISTING interview document (pasted or uploaded .txt/.md) into
// structured guide sections. Same graceful-AI pattern as the other services:
// Claude structures messy documents when ANTHROPIC_API_KEY is set; without a
// key, a deterministic heading/question parser does a solid job on typical
// interview docs. Either way the result only POPULATES the editor — the admin
// reviews and saves.
import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import type { GuideSectionInput } from '../domain/recruitment.types';

function liveKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY || undefined;
}

export interface GuideImportResult {
  sections: GuideSectionInput[];
  source: 'ai' | 'parser';
}

/** True for lines that look like a section heading rather than a question/bullet. */
function isHeading(line: string): boolean {
  if (/^#{1,4}\s+/.test(line)) return true; // markdown heading
  if (/^(\d+[.)]|[IVX]+\.)\s+.{2,60}$/.test(line) && !line.trim().endsWith('?')) return true; // "1. Technical"
  if (/^[A-Z][A-Za-z &/-]{2,50}:?$/.test(line.trim()) && !line.includes('?')) return true; // Title Case line
  return false;
}

const cleanHeading = (line: string) =>
  line
    .replace(/^#{1,4}\s+/, '')
    .replace(/^(\d+[.)]|[IVX]+\.)\s+/, '')
    .replace(/:$/, '')
    .replace(/\s*\(\s*\d+\s*%?\s*\)\s*$/, '')
    .trim();

/** "Technical (40%)" / "Technical — 40" → 40 */
const headingWeight = (line: string): number | undefined => {
  const m = /[（(]?\s*(\d{1,3})\s*%\s*[)）]?\s*$|[—-]\s*(\d{1,3})\s*$/.exec(line.trim());
  const w = m ? Number(m[1] ?? m[2]) : NaN;
  return Number.isFinite(w) && w > 0 && w <= 100 ? w : undefined;
};

const cleanBullet = (line: string) =>
  line.replace(/^\s*[-•*·]\s*/, '').replace(/^\s*\d+[.)]\s*/, '').trim();

/**
 * Deterministic fallback: headings become sections; question/bullet lines
 * under a heading become its guidance. Content before the first heading lands
 * in a "General" section so nothing silently disappears.
 */
export function parseGuideDocument(text: string): GuideSectionInput[] {
  const lines = text.split(/\r?\n/);
  const sections: { name: string; weight?: number; lines: string[] }[] = [];
  let current: { name: string; weight?: number; lines: string[] } | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (isHeading(line) && cleanHeading(line).length >= 3) {
      current = { name: cleanHeading(line).slice(0, 80), weight: headingWeight(line), lines: [] };
      sections.push(current);
      continue;
    }
    const bullet = cleanBullet(line);
    if (!bullet) continue;
    if (!current) {
      current = { name: 'General', lines: [] };
      sections.push(current);
    }
    current.lines.push(bullet);
  }

  return sections
    .filter((s) => s.name.length >= 2)
    .slice(0, 12)
    .map((s) => ({
      name: s.name,
      weight: s.weight,
      guidance: s.lines.slice(0, 12).join('\n') || undefined,
    }));
}

@Injectable()
export class GuideImporterService {
  private readonly logger = new Logger(GuideImporterService.name);

  async import(text: string): Promise<GuideImportResult> {
    const key = liveKey();
    if (!key) return { sections: parseGuideDocument(text), source: 'parser' };

    try {
      const client = new Anthropic({ apiKey: key });
      const res = await client.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 1500,
        system:
          'You convert interview documents into a structured interview guide. Return STRICT JSON: ' +
          '{"sections":[{"name":string,"weight":number|null,"guidance":string}]} with 3-8 sections. ' +
          '"guidance" is newline-separated guiding questions taken or adapted from the document. ' +
          'Weights are integers summing to 100 when the document implies emphasis, else null. ' +
          'Never invent sections about protected characteristics.',
        messages: [{ role: 'user', content: text.slice(0, 20000) }],
      });
      const out = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');
      const parsed = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1)) as {
        sections?: { name?: string; weight?: number | null; guidance?: string }[];
      };
      const sections = (parsed.sections ?? [])
        .filter((s) => s.name)
        .map((s) => ({
          name: String(s.name).slice(0, 80),
          weight: typeof s.weight === 'number' ? s.weight : undefined,
          guidance: s.guidance || undefined,
        }));
      if (sections.length === 0) throw new Error('no sections in AI response');
      return { sections, source: 'ai' };
    } catch (err) {
      this.logger.warn(`AI guide import failed, using parser fallback: ${(err as Error).message}`);
      return { sections: parseGuideDocument(text), source: 'parser' };
    }
  }
}
