// src/contexts/platform/infrastructure/copilot.service.ts
import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import type { Persona } from 'src/platform/auth/actor.decorator';
import type { ActorContext } from 'src/platform/auth/actor-context';
import { TenantPrismaService } from 'src/platform/database/tenant-prisma.service';

// Read at call time (not import time) so keys set/rotated after boot are
// honored; presence-only check — the SDK is the authority on validity.
function liveKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY || undefined;
}

// Hard ceiling on the API round trip. The SDK default is 10 MINUTES, which the
// UI experienced as "the agent keeps running forever" — the drawer's Thinking…
// bubble has no timeout of its own, so the backend must bound the wait.
const API_TIMEOUT_MS = 20_000;

const SYSTEM_BASE = `You are the HR Co-Pilot for NinjaHR, an agentic HR platform for the Canadian market.
Be concise and helpful — answer in 1-3 short sentences, no preamble. You understand Canadian
provincial employment standards (ESA), Ontario Bill 149, and Quebec Law 25 at a high level.

You are given a DATA snapshot of this company's live records below. Answer from the snapshot;
when an answer is not derivable from it, say exactly what is missing instead of inventing data.
Vacation guidance when asked about balances: ESA Ontario floor is 2 weeks/4% (3 weeks/6% at 5+
years of service); compute taken days from the approved Vacation leave in the snapshot and note
that the exact entitlement depends on company policy.

Hard guardrails you always respect and mention when relevant:
- You never execute destructive actions (deletions, status changes to Terminated/Rejected)
  without explicit human approval — you queue them for a one-click confirmation instead.
- For employee-facing questions you are scoped to the current user's own data only.
- This is illustrative guidance, not legal advice.`;

export interface CoPilotResult {
  text: string;
  live: boolean;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

@Injectable()
export class CopilotService {
  private readonly logger = new Logger(CopilotService.name);

  constructor(private readonly prisma: TenantPrismaService) {}

  async askCoPilot(question: string, persona: Persona, actor?: ActorContext): Promise<CoPilotResult> {
    const apiKey = liveKey();
    if (!apiKey) return { text: '', live: false };

    try {
      const [system, snapshot] = await Promise.all([
        Promise.resolve(this.systemFor(persona, actor)),
        this.snapshot(persona, actor),
      ]);
      const client = new Anthropic({ apiKey, timeout: API_TIMEOUT_MS, maxRetries: 1 });
      const response = await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1024,
        system: `${system}\n\nDATA (live tenant snapshot, JSON):\n${snapshot}`,
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

  private systemFor(persona: Persona, actor?: ActorContext): string {
    const name = actor?.employeeName;
    if (persona === 'admin') {
      return `${SYSTEM_BASE}\n\nYou are speaking to ${name ? `${name}, ` : ''}an HR Admin. You can read across Recruitment, Onboarding, Leave, Documents, Performance, and Offboarding, and you can queue multi-step workflows for approval.`;
    }
    return `${SYSTEM_BASE}\n\nYou are speaking to ${name ?? 'an employee'}${actor?.department ? ` (${actor.department})` : ''}. Answer questions about their own leave, training, and HR policies only. You cannot see other employees' data.`;
  }

  /**
   * Compact, tenant-scoped context so answers reflect real records (the
   * previous prompt had NO data — the model could only bluff). Admin sees the
   * whole workspace; employees see only their own row + leave.
   */
  private async snapshot(persona: Persona, actor?: ActorContext): Promise<string> {
    try {
      if (persona !== 'admin') {
        if (!actor?.employeeId) return '{"note":"no employee record linked to this account"}';
        const [me, leave] = await Promise.all([
          this.prisma.employee.findUnique({
            where: { id: actor.employeeId },
            select: { name: true, title: true, department: true, province: true, hireDate: true, status: true },
          }),
          this.prisma.leaveRequest.findMany({
            where: { employeeId: actor.employeeId },
            select: { type: true, status: true, start: true, end: true, days: true },
            orderBy: { start: 'desc' },
            take: 25,
          }),
        ]);
        return JSON.stringify({
          me: me && { ...me, hireDate: iso(me.hireDate) },
          myLeave: leave.map((l) => ({ ...l, start: iso(l.start), end: iso(l.end) })),
        });
      }

      const [settings, employees, leave, reqs, cases] = await Promise.all([
        this.prisma.companySettings.findFirst({ select: { companyName: true, provinces: true } }),
        this.prisma.employee.findMany({
          select: { name: true, title: true, department: true, province: true, hireDate: true, status: true },
          orderBy: { name: 'asc' },
          take: 100,
        }),
        this.prisma.leaveRequest.findMany({
          select: { type: true, status: true, start: true, end: true, days: true, employee: { select: { name: true } } },
          orderBy: { start: 'desc' },
          take: 200,
        }),
        this.prisma.requisition.findMany({
          select: { title: true, province: true, status: true, salaryMin: true, salaryMax: true },
          take: 50,
        }),
        this.prisma.onboardingCase.findMany({
          select: { name: true, status: true, startDate: true },
          take: 50,
        }),
      ]);
      return JSON.stringify({
        company: settings,
        employees: employees.map((e) => ({ ...e, hireDate: iso(e.hireDate) })),
        leaveRequests: leave.map((l) => ({
          employee: l.employee.name,
          type: l.type,
          status: l.status,
          start: iso(l.start),
          end: iso(l.end),
          days: l.days,
        })),
        requisitions: reqs,
        onboardingCases: cases.map((c) => ({ ...c, startDate: iso(c.startDate) })),
      });
    } catch (err) {
      // Snapshot failures must never take the copilot down with them.
      this.logger.warn(`copilot snapshot failed: ${err instanceof Error ? err.message : String(err)}`);
      return '{"note":"live data snapshot unavailable"}';
    }
  }
}
