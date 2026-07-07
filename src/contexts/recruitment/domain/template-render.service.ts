// src/contexts/recruitment/domain/template-render.service.ts
// Pure {{variable}} substitution for communication templates. This module is
// the single "send" seam — today a rendered message is only written to the
// CommunicationLog; a real email provider can be plugged in behind it later.

export interface TemplateVars {
  candidate_name?: string;
  job_title?: string;
  company?: string;
  interview_date?: string;
  [key: string]: string | undefined;
}

export function renderTemplate(text: string, vars: TemplateVars): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const value = vars[key];
    return value !== undefined && value !== '' ? value : `[${key}]`;
  });
}
