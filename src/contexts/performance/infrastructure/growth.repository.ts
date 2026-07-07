// src/contexts/performance/infrastructure/growth.repository.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from 'src/platform/database/prisma.service';
import type { ActorContext } from 'src/platform/auth/actor-context';
import type {
  FeedbackRequestInput,
  GrowthGoal,
  GrowthOverview,
  KudosInput,
  KudosItem,
  OneOnOneSync,
  PeerFeedback,
} from '../domain/growth.types';
import { rowToFeedback, rowToGoal, rowToKudos, rowToSync } from './growth.mapper';

const GOAL_INCLUDE = {
  updates: { orderBy: { createdAt: 'desc' as const }, take: 10 },
} as const;

const FEEDBACK_INCLUDE = {
  requester: { select: { name: true } },
  colleague: { select: { name: true } },
} as const;

@Injectable()
export class GrowthRepository {
  constructor(private readonly prisma: PrismaService) {}

  /* ------------------------------ Reads ------------------------------ */

  async getGrowth(actor: ActorContext): Promise<GrowthOverview> {
    if (!actor.employeeId) {
      return { goals: [], nextSync: null, feedbackSent: [], feedbackInbox: [], kudos: [] };
    }
    const employeeId = actor.employeeId;
    const [goals, syncs, sent, inbox, kudos] = await Promise.all([
      this.prisma.goal.findMany({
        where: { employeeId },
        orderBy: { createdAt: 'asc' },
        include: GOAL_INCLUDE,
      }),
      this.prisma.oneOnOne.findMany({
        where: { employeeId },
        orderBy: { scheduledAt: 'desc' },
      }),
      this.prisma.feedbackRequest.findMany({
        where: { requesterId: employeeId },
        orderBy: { createdAt: 'desc' },
        include: FEEDBACK_INCLUDE,
      }),
      this.prisma.feedbackRequest.findMany({
        where: { colleagueId: employeeId },
        orderBy: { createdAt: 'desc' },
        include: FEEDBACK_INCLUDE,
      }),
      this.prisma.kudos.findMany({
        where: { toId: employeeId },
        orderBy: { createdAt: 'desc' },
        take: 25,
        include: { from: { select: { name: true } } },
      }),
    ]);
    // Next upcoming sync; if none scheduled ahead, surface the most recent one
    // so the shared agenda / action items stay reachable.
    const now = Date.now();
    const upcoming = [...syncs].reverse().find((s) => s.scheduledAt.getTime() >= now);
    const nextSync = upcoming ?? syncs[0] ?? null;
    return {
      goals: goals.map(rowToGoal),
      nextSync: nextSync ? rowToSync(nextSync) : null,
      feedbackSent: sent.map(rowToFeedback),
      feedbackInbox: inbox.map(rowToFeedback),
      kudos: kudos.map(rowToKudos),
    };
  }

  /* ------------------------------ Goals ------------------------------ */

  /** Owner logs a progress update (weekly cadence); HR may adjust anyone's. */
  async updateGoalProgress(
    goalId: string,
    input: { progress: number; note?: string },
    actor: ActorContext,
  ): Promise<GrowthGoal[]> {
    const goal = await this.prisma.goal.findUnique({ where: { id: goalId } });
    if (!goal) throw new NotFoundException('Goal not found');
    if (goal.employeeId !== actor.employeeId && actor.role !== 'HR_ADMIN') {
      throw new ForbiddenException('You can only update your own goals');
    }
    await this.prisma.$transaction([
      this.prisma.goalUpdate.create({
        data: { goalId, progress: input.progress, note: input.note?.trim() || null },
      }),
      this.prisma.goal.update({
        where: { id: goalId },
        data: {
          progress: input.progress,
          status: input.progress >= 100 ? 'COMPLETED' : 'ACTIVE',
        },
      }),
    ]);
    const rows = await this.prisma.goal.findMany({
      where: { employeeId: goal.employeeId },
      orderBy: { createdAt: 'asc' },
      include: GOAL_INCLUDE,
    });
    return rows.map(rowToGoal);
  }

  /* ----------------------------- 1-on-1s ----------------------------- */

  /** Shared agenda: the employee, their department manager, and HR may write. */
  private async loadSyncForWrite(syncId: string, actor: ActorContext) {
    const sync = await this.prisma.oneOnOne.findUnique({
      where: { id: syncId },
      include: { employee: { select: { department: true } } },
    });
    if (!sync) throw new NotFoundException('1-on-1 not found');
    const isOwner = actor.employeeId === sync.employeeId;
    const isDeptManager =
      actor.role === 'MANAGER' && actor.department === sync.employee.department;
    if (!isOwner && !isDeptManager && actor.role !== 'HR_ADMIN') {
      throw new ForbiddenException('Only the employee, their manager, or HR can edit this agenda');
    }
    return sync;
  }

  async addTalkingPoint(syncId: string, text: string, actor: ActorContext): Promise<OneOnOneSync> {
    const sync = await this.loadSyncForWrite(syncId, actor);
    const points = Array.isArray(sync.talkingPoints) ? sync.talkingPoints : [];
    const author = actor.employeeName ?? 'HR';
    const updated = await this.prisma.oneOnOne.update({
      where: { id: syncId },
      data: { talkingPoints: [...points, { id: randomUUID(), author, text: text.trim() }] },
    });
    return rowToSync(updated);
  }

  async removeTalkingPoint(syncId: string, pointId: string, actor: ActorContext): Promise<OneOnOneSync> {
    const sync = await this.loadSyncForWrite(syncId, actor);
    const points = Array.isArray(sync.talkingPoints) ? sync.talkingPoints : [];
    const point = points.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (p: any) => p && p.id === pointId,
    ) as { author?: string } | undefined;
    if (!point) throw new NotFoundException('Talking point not found');
    // Authors remove their own points; HR can prune anything.
    if (point.author !== actor.employeeName && actor.role !== 'HR_ADMIN') {
      throw new ForbiddenException('You can only remove talking points you added');
    }
    const updated = await this.prisma.oneOnOne.update({
      where: { id: syncId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { talkingPoints: points.filter((p: any) => p && p.id !== pointId) },
    });
    return rowToSync(updated);
  }

  async addActionItem(syncId: string, text: string, actor: ActorContext): Promise<OneOnOneSync> {
    const sync = await this.loadSyncForWrite(syncId, actor);
    const items = Array.isArray(sync.actionItems) ? sync.actionItems : [];
    const updated = await this.prisma.oneOnOne.update({
      where: { id: syncId },
      data: { actionItems: [...items, { id: randomUUID(), text: text.trim(), done: false }] },
    });
    return rowToSync(updated);
  }

  async toggleActionItem(
    syncId: string,
    itemId: string,
    done: boolean,
    actor: ActorContext,
  ): Promise<OneOnOneSync> {
    const sync = await this.loadSyncForWrite(syncId, actor);
    const items = Array.isArray(sync.actionItems) ? sync.actionItems : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!items.some((i: any) => i && i.id === itemId)) {
      throw new NotFoundException('Action item not found');
    }
    const updated = await this.prisma.oneOnOne.update({
      where: { id: syncId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { actionItems: items.map((i: any) => (i && i.id === itemId ? { ...i, done } : i)) },
    });
    return rowToSync(updated);
  }

  /* -------------------------- Peer feedback -------------------------- */

  async requestFeedback(input: FeedbackRequestInput, actor: ActorContext): Promise<PeerFeedback[]> {
    if (!actor.employeeId) throw new ForbiddenException('No employee identity');
    if (input.colleagueId === actor.employeeId) {
      throw new BadRequestException('Pick a colleague — you cannot request feedback from yourself');
    }
    const colleague = await this.prisma.employee.findUnique({ where: { id: input.colleagueId } });
    if (!colleague) throw new NotFoundException('Colleague not found');
    await this.prisma.feedbackRequest.create({
      data: {
        requesterId: actor.employeeId,
        colleagueId: input.colleagueId,
        topic: input.topic.trim(),
        message: input.message?.trim() || null,
      },
    });
    const rows = await this.prisma.feedbackRequest.findMany({
      where: { requesterId: actor.employeeId },
      orderBy: { createdAt: 'desc' },
      include: FEEDBACK_INCLUDE,
    });
    return rows.map(rowToFeedback);
  }

  /** Only the asked colleague can answer — feedback is personal, HR included out. */
  async respondFeedback(id: string, response: string, actor: ActorContext): Promise<PeerFeedback[]> {
    const row = await this.prisma.feedbackRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Feedback request not found');
    if (row.colleagueId !== actor.employeeId) {
      throw new ForbiddenException('Only the colleague who was asked can respond');
    }
    if (row.status === 'COMPLETED') {
      throw new BadRequestException('This request has already been answered');
    }
    await this.prisma.feedbackRequest.update({
      where: { id },
      data: { status: 'COMPLETED', response: response.trim(), respondedAt: new Date() },
    });
    const rows = await this.prisma.feedbackRequest.findMany({
      where: { colleagueId: actor.employeeId },
      orderBy: { createdAt: 'desc' },
      include: FEEDBACK_INCLUDE,
    });
    return rows.map(rowToFeedback);
  }

  /* ------------------------------ Kudos ------------------------------ */

  async giveKudos(input: KudosInput, actor: ActorContext): Promise<KudosItem> {
    if (!actor.employeeId) throw new ForbiddenException('No employee identity');
    if (input.toEmployeeId === actor.employeeId) {
      throw new BadRequestException('Kudos go to teammates — pick someone else');
    }
    const recipient = await this.prisma.employee.findUnique({ where: { id: input.toEmployeeId } });
    if (!recipient) throw new NotFoundException('Recipient not found');
    const created = await this.prisma.kudos.create({
      data: {
        fromId: actor.employeeId,
        toId: input.toEmployeeId,
        message: input.message.trim(),
        emoji: input.emoji?.trim() || null,
      },
      include: { from: { select: { name: true } } },
    });
    return rowToKudos(created);
  }
}
