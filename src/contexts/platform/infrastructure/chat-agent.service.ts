import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { ActorContext } from 'src/platform/auth/actor-context';
import type { Persona } from 'src/platform/auth/actor.decorator';
import type { LlmMessage } from 'src/platform/ai/llm-provider';
import { GuardedAgentService } from 'src/platform/ai/guardrails/guarded-agent.service';
import { buildAgentSystem } from '../domain/agent-prompt';
import type { AgentSnapshot, ConversationView } from '../domain/chat.types';
import type { PolicyExcerpt } from '../domain/policy.types';
import { PolicyRetrievalService } from './policy-retrieval.service';
import { SnapshotService } from './snapshot.service';
import { ConversationRepository } from './conversation.repository';

const CHAT_OFFLINE =
  'AI is not configured right now. I can still see your live HR record summary, but I can’t generate or interpret policy answers until an administrator configures Gemini.';

function ownRecordSummary(snapshot: AgentSnapshot): string {
  try {
    const value = JSON.parse(snapshot.json) as { me?: { name?: string; title?: string; department?: string }; myLeave?: unknown[] };
    if (!value.me) return '';
    const details = [value.me.name, value.me.title, value.me.department].filter(Boolean).join(' · ');
    const leave = Array.isArray(value.myLeave) ? ` ${value.myLeave.length} leave request(s) are visible.` : '';
    return `${details ? ` Your record: ${details}.` : ''}${leave}`;
  } catch {
    return '';
  }
}

@Injectable()
export class ChatAgentService {
  private readonly logger = new Logger(ChatAgentService.name);

  constructor(
    private readonly conversations: ConversationRepository,
    private readonly snapshots: SnapshotService,
    private readonly policies: PolicyRetrievalService,
    private readonly guarded: GuardedAgentService,
  ) {}

  async send(input: {
    conversationId: string;
    question: string;
    persona: Persona;
    actor: ActorContext;
  }): Promise<ConversationView> {
    const userId = input.actor.userId;
    if (!userId || !(await this.conversations.findOwned(input.conversationId, userId))) {
      throw new NotFoundException('Conversation not found');
    }
    const afterUser = await this.conversations.appendOwned(input.conversationId, userId, {
      role: 'user',
      content: input.question,
    });
    if (!afterUser) throw new NotFoundException('Conversation not found');

    const [snapshot, excerpts] = await Promise.all([
      this.safeSnapshot(input.persona, input.actor),
      this.safePolicies(input.question),
    ]);
    const messages: LlmMessage[] = afterUser.messages.slice(-20).map(({ role, content }) => ({ role, content }));
    const result = await this.guarded.ask({
      system: buildAgentSystem({
        persona: input.persona,
        actor: input.actor,
        mode: 'chat',
        snapshotJson: snapshot.json,
        excerpts,
      }),
      messages,
      persona: input.persona,
      userId,
      maxTokens: 4096,
      otherEmployeeNames: snapshot.otherEmployeeNames,
    });
    const blockedCategory = result.verdict.allowed ? null : result.verdict.category ?? 'provider_blocked';
    const text = result.verdict.allowed && !result.live && !result.text
      ? `${CHAT_OFFLINE}${ownRecordSummary(snapshot)}`
      : result.text;
    const conversation = await this.conversations.appendOwned(input.conversationId, userId, {
      role: 'assistant',
      content: text,
      blockedCategory,
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  async askStateless(input: {
    question: string;
    persona: Persona;
    actor?: ActorContext;
  }): Promise<{ text: string; live: boolean }> {
    const [snapshot, excerpts] = await Promise.all([
      this.safeSnapshot(input.persona, input.actor),
      this.safePolicies(input.question),
    ]);
    const result = await this.guarded.ask({
      system: buildAgentSystem({
        persona: input.persona,
        actor: input.actor,
        mode: 'quick',
        snapshotJson: snapshot.json,
        excerpts,
      }),
      messages: [{ role: 'user', content: input.question }],
      persona: input.persona,
      userId: input.actor?.userId ?? null,
      maxTokens: 1024,
      otherEmployeeNames: snapshot.otherEmployeeNames,
    });
    if (!result.verdict.allowed) return { text: result.text, live: true };
    return { text: result.text, live: result.live };
  }

  private async safeSnapshot(persona: Persona, actor?: ActorContext): Promise<AgentSnapshot> {
    try {
      return await this.snapshots.build(persona, actor);
    } catch (error) {
      this.logger.warn(`snapshot context failed: ${error instanceof Error ? error.message : String(error)}`);
      return { json: '{"note":"live data snapshot unavailable"}', otherEmployeeNames: [] };
    }
  }

  private async safePolicies(question: string): Promise<PolicyExcerpt[]> {
    try {
      return await this.policies.retrieve(question);
    } catch (error) {
      this.logger.warn(`policy context failed: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
}
