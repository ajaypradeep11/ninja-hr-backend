// Vendor-neutral LLM contract. Interface shapes are copied verbatim from the
// approved design and are frozen — Modules B–E build against these names.
export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LlmRequest {
  system: string;
  messages: LlmMessage[];
  maxTokens: number;
  temperature?: number;
  safety?: 'strict' | 'default';
  document?: { base64: string; mimeType: string };
}

export interface LlmResult {
  text: string;
  blocked?: { reason: string };
}

export interface LlmProvider {
  complete(req: LlmRequest): Promise<LlmResult>;
  embed(texts: string[]): Promise<number[][]>;
  isLive(): boolean;
}

export interface LlmClassifier {
  classify(system: string, text: string): Promise<string>;
}

export const LLM_PROVIDER_CHAT = 'LLM_PROVIDER_CHAT';
export const LLM_CLASSIFIER = 'LLM_CLASSIFIER';

export class LlmUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmUnavailableError';
  }
}
