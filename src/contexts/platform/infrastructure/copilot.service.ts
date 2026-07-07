// src/contexts/platform/infrastructure/copilot.service.ts
import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import type { Persona } from 'src/platform/auth/actor.decorator';

// Read at call time (not import time) so keys set/rotated after boot are
// honored; presence-only check — the SDK is the authority on validity.
function liveKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY || undefined;
}

const SYSTEM_BASE = `You are the HR Co-Pilot for TestHR, an agentic HR platform for the Canadian market.
Be concise and helpful — answer in 1-3 short sentences, no preamble. You understand Canadian
provincial employment standards (ESA), Ontario Bill 149, and Quebec Law 25 at a high level.

Hard guardrails you always respect and mention when relevant:
- You never execute destructive actions (deletions, status changes to Terminated/Rejected)
  without explicit human approval — you queue them for a one-click confirmation instead.
- For employee-facing questions you are scoped to the current user's own data only.
- This is illustrative guidance, not legal advice.`;

const SYSTEM_ADMIN = `${SYSTEM_BASE}

You are speaking to an HR Admin (Sarah Mitchell). You can read across Recruitment, Onboarding,
Leave, Documents, Performance, and Offboarding, and you can queue multi-step workflows for approval.`;

const SYSTEM_EMPLOYEE = `${SYSTEM_BASE}

You are speaking to an employee (Jim Scott, a BC-based Account Executive). Answer questions about
his leave balances, pay schedule, training, and HR policies. You cannot see other employees' data.`;

export interface CoPilotResult {
  text: string;
  live: boolean;
}

@Injectable()
export class CopilotService {
  private readonly logger = new Logger(CopilotService.name);

  async askCoPilot(question: string, persona: Persona): Promise<CoPilotResult> {
    const apiKey = liveKey();
    if (!apiKey) return { text: '', live: false };

    try {
      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1024,
        system: persona === 'admin' ? SYSTEM_ADMIN : SYSTEM_EMPLOYEE,
        messages: [{ role: 'user', content: question }],
      });
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .trim();
      return { text: text || '', live: true };
    } catch (err) {
      // Degrade to offline mode, but leave an operator signal — a revoked key
      // or rate limit must not be silently indistinguishable from "no key".
      this.logger.error(`Anthropic API call failed: ${err instanceof Error ? err.message : String(err)}`);
      return { text: '', live: false };
    }
  }
}
