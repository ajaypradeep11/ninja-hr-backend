// src/contexts/recruitment/infrastructure/message-drafter.service.ts
// AI candidate-message drafter with a graceful template fallback (same key
// pattern as jd-generator.service.ts). With ANTHROPIC_API_KEY set, Claude
// drafts the message from the recruiter's instruction; without a key, a
// deterministic intent-matched template is returned. Either way the output
// only POPULATES the editor — a human reviews and sends. The drafter never
// sends mail and never moves a candidate's stage (Anti-Bias Shield).
import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

function liveKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY || undefined;
}

export interface DraftInput {
  instruction: string;
  candidateName: string;
  jobTitle: string;
  company: string;
}

export interface DraftResult {
  subject: string;
  body: string;
  source: 'ai' | 'template';
}

/** Intent-matched fallback so drafting works before an API key is configured. */
function templateDraft(input: DraftInput): { subject: string; body: string } {
  const i = input.instruction.toLowerCase();
  const sign = `Best regards,\nThe ${input.company} Talent Team`;

  if (/(decline|reject|not moving|unsuccessful|pass on)/.test(i)) {
    const reapply = /(again|future|re-?apply|6 months|later)/.test(i)
      ? `\n\nWe were genuinely impressed by your background, and we'd love to see you apply again in the future — our team and openings grow quickly.`
      : '';
    return {
      subject: `Update on your ${input.jobTitle} application`,
      body: `Hi ${input.candidateName},\n\nThank you for the time and care you put into your application for the ${input.jobTitle} role. After careful review, we've decided not to move forward at this stage.${reapply}\n\nWe wish you every success in your search.\n\n${sign}`,
    };
  }
  if (/(interview|schedule|invite|meet)/.test(i)) {
    return {
      subject: `Interview invitation — ${input.jobTitle} at ${input.company}`,
      body: `Hi ${input.candidateName},\n\nGreat news — we'd like to invite you to interview for the ${input.jobTitle} position. Could you share a few times that work for you this week or next?\n\nWe'll confirm the panel and format as soon as we hear back.\n\n${sign}`,
    };
  }
  if (/(offer|congratulat)/.test(i)) {
    return {
      subject: `Offer — ${input.jobTitle} at ${input.company}`,
      body: `Hi ${input.candidateName},\n\nCongratulations! We're delighted to extend you an offer for the ${input.jobTitle} role. The formal offer letter with full details will follow shortly.\n\nWe can't wait to work with you.\n\n${sign}`,
    };
  }
  if (/(follow|update|status|wait|delay|touch)/.test(i)) {
    return {
      subject: `Your ${input.jobTitle} application — quick update`,
      body: `Hi ${input.candidateName},\n\nThanks for your patience while we review applications for the ${input.jobTitle} role. Your application is still active, and we expect to share next steps soon.\n\nThank you for your continued interest in ${input.company}.\n\n${sign}`,
    };
  }
  // Generic: acknowledge + weave in the instruction's gist for the human to shape.
  return {
    subject: `Regarding your ${input.jobTitle} application`,
    body: `Hi ${input.candidateName},\n\nThank you for your interest in the ${input.jobTitle} role at ${input.company}. [Draft note for recruiter — instruction: "${input.instruction}". Edit this message before sending.]\n\n${sign}`,
  };
}

@Injectable()
export class MessageDrafterService {
  private readonly logger = new Logger(MessageDrafterService.name);

  async draft(input: DraftInput): Promise<DraftResult> {
    const key = liveKey();
    if (!key) return { ...templateDraft(input), source: 'template' };

    try {
      const client = new Anthropic({ apiKey: key });
      const res = await client.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 700,
        system:
          'You draft professional, warm, concise recruiting emails for a Canadian HR platform. ' +
          'Return STRICT JSON: {"subject": string, "body": string}. Plain text body, no markdown. ' +
          'Never promise outcomes, never reference protected characteristics, never mention AI screening scores.',
        messages: [
          {
            role: 'user',
            content: `Candidate: ${input.candidateName}\nRole: ${input.jobTitle}\nCompany: ${input.company}\nInstruction from recruiter: ${input.instruction}`,
          },
        ],
      });
      const text = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');
      const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as {
        subject?: string;
        body?: string;
      };
      if (!parsed.subject || !parsed.body) throw new Error('missing fields in AI response');
      return { subject: parsed.subject, body: parsed.body, source: 'ai' };
    } catch (err) {
      this.logger.warn(`AI draft failed, using template fallback: ${(err as Error).message}`);
      return { ...templateDraft(input), source: 'template' };
    }
  }
}
