export const GUARD_CATEGORIES = [
  'sexual',
  'harassment_profanity',
  'violence_illegal',
  'self_harm',
  'off_topic_coding',
  'off_topic_other',
  'prompt_injection',
  'pii_leak',
  'provider_blocked',
] as const;

export type GuardCategory = (typeof GUARD_CATEGORIES)[number];

export interface GuardVerdict {
  allowed: boolean;
  category?: GuardCategory;
  refusalMessage?: string;
}

export interface BlockedVerdict extends GuardVerdict {
  allowed: false;
  category: GuardCategory;
  refusalMessage: string;
}

export type GuardDecision = { allowed: true } | BlockedVerdict;
