import type { BlockedVerdict, GuardCategory } from './guard-verdict';

export const REFUSALS: Record<GuardCategory, string> = {
  sexual:
    "I can't help with sexual or explicit content. I'm NinjaHR's HR assistant — I'm happy to help with HR questions, your leave, company policies, or drafting workplace documents.",
  harassment_profanity:
    "I can't engage with harassing or abusive language. If you have a workplace concern, I can help you raise it constructively — or answer any HR question.",
  violence_illegal:
    "I can't help with anything involving violence or illegal activity. If there is a workplace safety concern, please contact your HR administrator right away.",
  self_harm:
    "I'm really sorry you're going through this — it sounds heavy, and you don't have to carry it alone. I'm not able to provide crisis support, but you can reach Talk Suicide Canada at 1-833-456-4566, or call or text 9-8-8, any time, day or night. If you're in immediate danger, please call 911. Your workplace may also offer a confidential Employee Assistance Program (EAP) — your HR administrator can connect you.",
  off_topic_coding:
    "I'm NinjaHR's HR assistant, so I can't help with writing code — but I'm happy to help with HR questions, your leave, policies, or drafting workplace documents.",
  off_topic_other:
    "That's outside what I can help with — I'm NinjaHR's HR assistant. I can answer HR questions, look into your leave, explain company policies, or help draft workplace documents.",
  prompt_injection:
    "I can't follow instructions that try to change how I operate or reveal how I'm configured. I'm happy to help with HR questions, your leave, company policies, or drafting workplace documents.",
  pii_leak:
    "I can't share information about other employees. I can help with your own records, your leave, and company policies.",
  provider_blocked:
    "I couldn't produce a safe answer to that request. Please try rephrasing it, or ask me an HR, leave, or policy question.",
};

export function refusalVerdict(category: GuardCategory): BlockedVerdict {
  return { allowed: false, category, refusalMessage: REFUSALS[category] };
}
