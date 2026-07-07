// src/contexts/performance/infrastructure/growth.mapper.ts
import type {
  GrowthGoal,
  GoalStatus,
  FeedbackStatus,
  KudosItem,
  OneOnOneSync,
  PeerFeedback,
  SyncActionItem,
  TalkingPoint,
} from '../domain/growth.types';

const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

export const goalStatusFromDb: Record<string, GoalStatus> = {
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
};

export const feedbackStatusFromDb: Record<string, FeedbackStatus> = {
  PENDING: 'Pending',
  COMPLETED: 'Completed',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToGoal(row: any): GrowthGoal {
  return {
    id: row.id,
    title: row.title,
    alignment: row.alignment ?? undefined,
    progress: row.progress,
    due: row.due ? isoDate(row.due) : undefined,
    status: goalStatusFromDb[row.status] ?? 'Active',
    updates: (row.updates ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (u: any) => ({
        id: u.id,
        progress: u.progress,
        note: u.note ?? undefined,
        at: u.createdAt.toISOString(),
      }),
    ),
  };
}

/** Json columns come back untyped — coerce defensively so a malformed row
 *  can never take the whole growth page down. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asArray(v: any): any[] {
  return Array.isArray(v) ? v : [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToSync(row: any): OneOnOneSync {
  return {
    id: row.id,
    managerName: row.managerName,
    scheduledAt: row.scheduledAt.toISOString(),
    talkingPoints: asArray(row.talkingPoints).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (p: any): TalkingPoint => ({
        id: String(p.id),
        author: String(p.author ?? ''),
        text: String(p.text ?? ''),
      }),
    ),
    actionItems: asArray(row.actionItems).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (i: any): SyncActionItem => ({
        id: String(i.id),
        text: String(i.text ?? ''),
        done: Boolean(i.done),
      }),
    ),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToFeedback(row: any): PeerFeedback {
  return {
    id: row.id,
    requesterName: row.requester?.name ?? '',
    colleagueName: row.colleague?.name ?? '',
    colleagueId: row.colleagueId,
    topic: row.topic,
    message: row.message ?? undefined,
    status: feedbackStatusFromDb[row.status] ?? 'Pending',
    response: row.response ?? undefined,
    createdAt: row.createdAt.toISOString(),
    respondedAt: row.respondedAt ? row.respondedAt.toISOString() : undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToKudos(row: any): KudosItem {
  return {
    id: row.id,
    fromName: row.from?.name ?? undefined,
    message: row.message,
    emoji: row.emoji ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}
