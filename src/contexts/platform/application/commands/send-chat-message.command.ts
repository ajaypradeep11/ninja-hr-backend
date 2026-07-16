import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UnauthorizedException } from '@nestjs/common';
import type { ActorContext } from 'src/platform/auth/actor-context';
import type { Persona } from 'src/platform/auth/actor.decorator';
import type { ConversationView } from '../../domain/chat.types';
import { ChatAgentService } from '../../infrastructure/chat-agent.service';

export class SendChatMessageCommand {
  constructor(
    public readonly conversationId: string,
    public readonly content: string,
    public readonly persona: Persona,
    public readonly actor: ActorContext,
  ) {}
}

@CommandHandler(SendChatMessageCommand)
export class SendChatMessageHandler implements ICommandHandler<SendChatMessageCommand, ConversationView> {
  constructor(private readonly chat: ChatAgentService) {}
  execute(command: SendChatMessageCommand): Promise<ConversationView> {
    if (!command.actor.userId) throw new UnauthorizedException('A verified user identity is required');
    return this.chat.send({
      conversationId: command.conversationId,
      question: command.content,
      persona: command.persona,
      actor: command.actor,
    });
  }
}
