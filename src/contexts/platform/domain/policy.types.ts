export type PolicySourceType = 'pdf' | 'text';

export type PolicyDocumentStatus = 'Processing' | 'Ready' | 'Failed';

export interface PolicyDocumentSummary {
  id: string;
  title: string;
  sourceType: PolicySourceType;
  status: PolicyDocumentStatus;
  uploadedAt: string;
  chunkCount: number;
}

export interface PolicyExcerpt {
  title: string;
  heading: string | null;
  ordinal: number;
  text: string;
}

export const AI_NOT_CONFIGURED_MESSAGE =
  'AI is not configured — handbook ingestion requires GEMINI_API_KEY. Set the key and try again.';
