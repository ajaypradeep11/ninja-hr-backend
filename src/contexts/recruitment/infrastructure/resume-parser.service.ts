// src/contexts/recruitment/infrastructure/resume-parser.service.ts
// AI-powered résumé parser with a graceful, key-free fallback (mirrors the
// copilot.service.ts pattern). With ANTHROPIC_API_KEY set, Claude extracts
// structured data from the résumé (text sent directly; PDFs sent as a document
// content block — no parser library needed). With no key, it does a light
// regex extraction of email/phone and marks the parse SKIPPED.
import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

function liveKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY || undefined;
}

export interface WorkHistoryEntry {
  company: string;
  title: string;
  dates?: string;
}

export interface ParsedResume {
  status: 'PARSED' | 'SKIPPED' | 'FAILED';
  email?: string;
  phone?: string;
  skills: string[];
  workHistory: WorkHistoryEntry[];
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;

const EXTRACT_PROMPT = `Extract structured data from this résumé. Return ONLY a JSON object with keys:
"email" (string|null), "phone" (string|null), "skills" (string array of technical/professional skills),
"workHistory" (array of {"company","title","dates"}). No prose, no markdown fences — just the JSON.`;

@Injectable()
export class ResumeParserService {
  private readonly logger = new Logger(ResumeParserService.name);

  /** Best-effort parse; never throws — résumé extraction must not block an application. */
  async parse(input: { text?: string; fileBase64?: string; mimeType?: string }): Promise<ParsedResume> {
    const apiKey = liveKey();

    // Fallback path: no key → regex email/phone from whatever text we have.
    if (!apiKey) {
      const text = input.text ?? '';
      return {
        status: 'SKIPPED',
        email: EMAIL_RE.exec(text)?.[0],
        phone: PHONE_RE.exec(text)?.[0],
        skills: [],
        workHistory: [],
      };
    }

    try {
      const client = new Anthropic({ apiKey });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const content: any[] = [{ type: 'text', text: EXTRACT_PROMPT }];
      if (input.mimeType === 'application/pdf' && input.fileBase64) {
        content.push({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: input.fileBase64 },
        });
      } else {
        content.push({ type: 'text', text: `RÉSUMÉ:\n${input.text ?? ''}` });
      }

      const response = await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1500,
        messages: [{ role: 'user', content }],
      });
      const raw = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .trim()
        .replace(/^```(?:json)?/i, '')
        .replace(/```$/, '')
        .trim();
      const parsed = JSON.parse(raw) as {
        email?: string | null;
        phone?: string | null;
        skills?: string[];
        workHistory?: WorkHistoryEntry[];
      };
      return {
        status: 'PARSED',
        email: parsed.email ?? undefined,
        phone: parsed.phone ?? undefined,
        skills: Array.isArray(parsed.skills) ? parsed.skills.slice(0, 50) : [],
        workHistory: Array.isArray(parsed.workHistory) ? parsed.workHistory.slice(0, 25) : [],
      };
    } catch (err) {
      this.logger.error(`Résumé parse failed: ${err instanceof Error ? err.message : String(err)}`);
      // Still salvage regex contact info so the parse isn't a total loss.
      const text = input.text ?? '';
      return {
        status: 'FAILED',
        email: EMAIL_RE.exec(text)?.[0],
        phone: PHONE_RE.exec(text)?.[0],
        skills: [],
        workHistory: [],
      };
    }
  }
}
