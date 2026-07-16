import { LLM_CLASSIFIER } from '../llm-provider';
import type { LlmClassifier } from '../llm-provider';

// Module A owns the token; re-export it so guardrail consumers have one source.
export { LLM_CLASSIFIER };

export function asClassifier(candidate: unknown): LlmClassifier {
  const classifier = candidate as Partial<LlmClassifier> | null;
  if (classifier && typeof classifier.classify === 'function') {
    return classifier as LlmClassifier;
  }
  return {
    classify: () => Promise.reject(new Error('active chat provider exposes no classifier')),
  };
}
