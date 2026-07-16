import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { UnauthorizedException } from '@nestjs/common';
import type { ActorContext } from 'src/platform/auth/actor-context';
import type { ConversationView } from '../../domain/chat.types';
import { ConversationRepository } from '../../infrastructure/conversation.repository';

export class GetConversationsQuery {
  constructor(public readonly actor: ActorContext) {}
}

@QueryHandler(GetConversationsQuery)
export class GetConversationsHandler implements IQueryHandler<GetConversationsQuery, ConversationView[]> {
  constructor(private readonly conversations: ConversationRepository) {}
  execute({ actor }: GetConversationsQuery): Promise<ConversationView[]> {
    if (!actor.userId) throw new UnauthorizedException('A verified user identity is required');
    return this.conversations.listOwned(actor.userId);
  }
}
