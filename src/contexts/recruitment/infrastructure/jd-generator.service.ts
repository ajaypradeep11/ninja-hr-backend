// src/contexts/recruitment/infrastructure/jd-generator.service.ts
// AI job-description generator with a graceful template fallback (mirrors the
// copilot.service.ts key pattern). With ANTHROPIC_API_KEY set, Claude drafts an
// inclusive, Bill-149-aware JD; without a key it returns a solid template. The
// deterministic inclusive-language checker runs on the output either way.
import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { checkInclusiveLanguage, type InclusiveFlag } from '../domain/inclusive-language.service';

function liveKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY || undefined;
}

export interface JdGenInput {
  title: string;
  department: string;
  province: string;
  type: string;
  salaryMin: number;
  salaryMax: number;
  keyPoints?: string;
}

export interface JdGenResult {
  jd: string;
  source: 'ai' | 'template';
  inclusiveFlags: InclusiveFlag[];
}

function templateJd(input: JdGenInput): string {
  const reqs = (input.keyPoints ?? '')
    .split(/\n|,/)
    .map((r) => r.trim())
    .filter(Boolean);
  const salaryLine =
    input.salaryMin && input.salaryMax
      ? ` ($${input.salaryMin.toLocaleString()} – $${input.salaryMax.toLocaleString()} CAD)`
      : '';
  const ontarioFooter =
    input.province === 'ON'
      ? '\n\nPlease note: Artificial Intelligence is utilized in the screening process for this role.'
      : '';
  return `About the Role
We're hiring a ${input.title} (${input.type}) to join our ${input.department} team${
    salaryLine ? ` with a salary range of${salaryLine}` : ''
  }. We're a Canadian company committed to an inclusive, accessible workplace where diverse perspectives are valued.

What you'll do
• Own and deliver ${input.department} initiatives end-to-end.
• Collaborate across teams to achieve high-quality outcomes.
• Support and mentor colleagues, raising the bar for craft.

What you'll bring
${reqs.length ? reqs.map((r) => `• ${r}`).join('\n') : '• [Add key qualifications]'}

Compensation & Benefits
• Competitive salary${salaryLine}.
• Comprehensive health & dental benefits and an RRSP match.
• Flexible time off and a yearly learning budget.

We are an equal-opportunity employer. Accommodations are available on request for candidates taking part in all aspects of the selection process.${ontarioFooter}`;
}

@Injectable()
export class JdGeneratorService {
  private readonly logger = new Logger(JdGeneratorService.name);

  async generate(input: JdGenInput): Promise<JdGenResult> {
    const apiKey = liveKey();
    if (!apiKey) {
      const jd = templateJd(input);
      return { jd, source: 'template', inclusiveFlags: checkInclusiveLanguage(jd) };
    }

    try {
      const client = new Anthropic({ apiKey });
      const salary =
        input.salaryMin && input.salaryMax
          ? `$${input.salaryMin.toLocaleString()}–$${input.salaryMax.toLocaleString()} CAD`
          : 'competitive';
      const response = await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1500,
        system: `You write inclusive, bias-free job descriptions for the Canadian market. Rules:
- Use inclusive, gender-neutral, accessible language. Avoid masculine-coded words (aggressive, dominant, rockstar, ninja), ageist terms (young, energetic, digital native), and ableist wording.
- Include an equal-opportunity + accommodation statement.
- For Ontario roles, disclose the salary range and that AI is used in screening (Bill 149).
- Return ONLY the job-description text, no preamble.`,
        messages: [
          {
            role: 'user',
            content: `Write a job description.
Title: ${input.title}
Department: ${input.department}
Location/Province: ${input.province}
Type: ${input.type}
Salary: ${salary}
Key points: ${input.keyPoints ?? '(none provided)'}`,
          },
        ],
      });
      const jd = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .trim();
      if (!jd) throw new Error('empty completion');
      return { jd, source: 'ai', inclusiveFlags: checkInclusiveLanguage(jd) };
    } catch (err) {
      this.logger.error(`JD generation failed, using template: ${err instanceof Error ? err.message : String(err)}`);
      const jd = templateJd(input);
      return { jd, source: 'template', inclusiveFlags: checkInclusiveLanguage(jd) };
    }
  }
}
