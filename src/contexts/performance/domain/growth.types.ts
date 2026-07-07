// src/contexts/performance/domain/growth.types.ts
// Continuous performance management: goals, 1-on-1s, peer feedback, kudos.

export type GoalStatus = 'Active' | 'Completed';
export type FeedbackStatus = 'Pending' | 'Completed';

export interface GoalProgressUpdate {
  id: string;
  progress: number;
  note?: string;
  at: string; // ISO datetime
}

export interface GrowthGoal {
  id: string;
  title: string;
  /** Company strategy this goal ladders up to (e.g. "Q2 Global Revenue Target"). */
  alignment?: string;
  progress: number;
  due?: string; // ISO date YYYY-MM-DD
  status: GoalStatus;
  updates: GoalProgressUpdate[];
}

export interface TalkingPoint {
  id: string;
  author: string;
  text: string;
}

export interface SyncActionItem {
  id: string;
  text: string;
  done: boolean;
}

export interface OneOnOneSync {
  id: string;
  managerName: string;
  scheduledAt: string; // ISO datetime
  talkingPoints: TalkingPoint[];
  actionItems: SyncActionItem[];
}

export interface PeerFeedback {
  id: string;
  requesterName: string;
  colleagueName: string;
  colleagueId: string;
  topic: string;
  message?: string;
  status: FeedbackStatus;
  response?: string;
  createdAt: string;
  respondedAt?: string;
}

export interface KudosItem {
  id: string;
  fromName?: string;
  message: string;
  emoji?: string;
  createdAt: string;
}

/** Everything the employee growth page needs, scoped to the actor. */
export interface GrowthOverview {
  goals: GrowthGoal[];
  nextSync: OneOnOneSync | null;
  feedbackSent: PeerFeedback[];
  /** Requests where the actor is the colleague being asked for insights. */
  feedbackInbox: PeerFeedback[];
  kudos: KudosItem[];
}

export interface FeedbackRequestInput {
  colleagueId: string;
  topic: string;
  message?: string;
}

export interface KudosInput {
  toEmployeeId: string;
  message: string;
  emoji?: string;
}
