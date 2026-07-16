import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from 'src/platform/database/tenant-prisma.service';
import type { ChatRole, ConversationView } from '../domain/chat.types';

const messageOrder = { orderBy: { createdAt: 'asc' as const } };

function mapConversation(row: {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages: Array<{ id: string; role: string; content: string; blockedCategory: string | null; createdAt: Date }>;
}): ConversationView {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    messages: row.messages.map((message) => ({
      id: message.id,
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: message.content,
      blockedCategory: message.blockedCategory,
      createdAt: message.createdAt.toISOString(),
    })),
  };
}

@Injectable()
export class ConversationRepository {
  constructor(private readonly prisma: TenantPrismaService) {}

  async listOwned(userId: string): Promise<ConversationView[]> {
    const rows = await this.prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: { messages: messageOrder },
    });
    return rows.map(mapConversation);
  }

  async createOwned(userId: string): Promise<ConversationView> {
    const row = await this.prisma.conversation.create({
      // TenantPrismaService stamps companyId in its create extension. The
      // generated base-client type cannot express that runtime guarantee.
      data: { userId, title: 'New conversation' } as never,
      include: { messages: messageOrder },
    });
    return mapConversation(row);
  }

  async findOwned(id: string, userId: string): Promise<ConversationView | null> {
    const row = await this.prisma.conversation.findFirst({
      where: { id, userId },
      include: { messages: messageOrder },
    });
    return row ? mapConversation(row) : null;
  }

  async appendOwned(
    id: string,
    userId: string,
    message: { role: ChatRole; content: string; blockedCategory?: string | null },
  ): Promise<ConversationView | null> {
    const existing = await this.prisma.conversation.findFirst({
      where: { id, userId },
      select: { id: true, title: true, messages: { select: { id: true }, take: 1 } },
    });
    if (!existing) return null;
    const firstUserTurn = message.role === 'user' && existing.messages.length === 0;
    const normalized = message.content.trim().replace(/\s+/g, ' ');
    const title = normalized.length > 60 ? `${normalized.slice(0, 60)}…` : normalized;
    const row = await this.prisma.conversation.update({
      where: { id },
      data: {
        ...(firstUserTurn ? { title: title || 'New conversation' } : {}),
        messages: { create: { role: message.role, content: message.content, blockedCategory: message.blockedCategory ?? null } },
      },
      include: { messages: messageOrder },
    });
    return mapConversation(row);
  }

  async deleteOwned(id: string, userId: string): Promise<boolean> {
    const existing = await this.prisma.conversation.findFirst({ where: { id, userId }, select: { id: true } });
    if (!existing) return false;
    await this.prisma.conversation.delete({ where: { id } });
    return true;
  }
}
