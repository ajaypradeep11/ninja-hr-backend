import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UnauthorizedException } from '@nestjs/common';
import type { ActorContext } from 'src/platform/auth/actor-context';
import type { ConversationView } from '../../domain/chat.types';
import { ConversationRepository } from '../../infrastructure/conversation.repository';

export class CreateConversationCommand {
  constructor(public readonly actor: ActorContext) {}
}

@CommandHandler(CreateConversationCommand)
export class CreateConversationHandler implements ICommandHandler<CreateConversationCommand, ConversationView> {
  constructor(private readonly conversations: ConversationRepository) {}
  execute({ actor }: CreateConversationCommand): Promise<ConversationView> {
    if (!actor.userId) throw new UnauthorizedException('A verified user identity is required');
    return this.conversations.createOwned(actor.userId);
  }
}
