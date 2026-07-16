export type ChatRole = 'user' | 'assistant';

export interface ChatMessageView {
  id: string;
  role: ChatRole;
  content: string;
  blockedCategory: string | null;
  createdAt: string;
}

export interface ConversationView {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessageView[];
}

export interface AgentSnapshot {
  json: string;
  otherEmployeeNames: string[];
}

export type AgentMode = 'chat' | 'quick';
