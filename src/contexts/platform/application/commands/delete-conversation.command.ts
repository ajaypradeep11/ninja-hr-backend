import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { ActorContext } from 'src/platform/auth/actor-context';
import type { ConversationView } from '../../domain/chat.types';
import { ConversationRepository } from '../../infrastructure/conversation.repository';

export class DeleteConversationCommand {
  constructor(public readonly id: string, public readonly actor: ActorContext) {}
}

@CommandHandler(DeleteConversationCommand)
export class DeleteConversationHandler implements ICommandHandler<DeleteConversationCommand, ConversationView[]> {
  constructor(private readonly conversations: ConversationRepository) {}
  async execute({ id, actor }: DeleteConversationCommand): Promise<ConversationView[]> {
    if (!actor.userId) throw new UnauthorizedException('A verified user identity is required');
    if (!(await this.conversations.deleteOwned(id, actor.userId))) throw new NotFoundException('Conversation not found');
    return this.conversations.listOwned(actor.userId);
  }
}
