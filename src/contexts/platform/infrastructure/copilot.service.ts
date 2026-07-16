import { Injectable } from '@nestjs/common';
import type { Persona } from 'src/platform/auth/actor.decorator';
import type { ActorContext } from 'src/platform/auth/actor-context';
import { ChatAgentService } from './chat-agent.service';

export interface CoPilotResult {
  text: string;
  live: boolean;
}

@Injectable()
export class CopilotService {
  constructor(private readonly chat: ChatAgentService) {}

  askCoPilot(question: string, persona: Persona, actor?: ActorContext): Promise<CoPilotResult> {
    return this.chat.askStateless({ question, persona, actor });
  }
}
