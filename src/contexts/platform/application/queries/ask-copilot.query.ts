// src/contexts/platform/application/queries/ask-copilot.query.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CopilotService, type CoPilotResult } from '../../infrastructure/copilot.service';
import type { Persona } from 'src/platform/auth/actor.decorator';
import type { ActorContext } from 'src/platform/auth/actor-context';

export class AskCopilotQuery {
  constructor(
    public readonly question: string,
    public readonly persona: Persona,
    public readonly actor?: ActorContext,
  ) {}
}

@QueryHandler(AskCopilotQuery)
export class AskCopilotHandler implements IQueryHandler<AskCopilotQuery, CoPilotResult> {
  constructor(private readonly copilot: CopilotService) {}
  execute({ question, persona, actor }: AskCopilotQuery): Promise<CoPilotResult> {
    return this.copilot.askCoPilot(question, persona, actor);
  }
}
