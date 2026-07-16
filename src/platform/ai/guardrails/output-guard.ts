import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Persona } from 'src/platform/auth/actor.decorator';
import { scanBlocklist } from './blocklist';
import type { GuardDecision } from './guard-verdict';
import { refusalVerdict } from './refusals';

export function makeCanary(): string {
  return `cnry_${randomBytes(8).toString('hex')}`;
}

export interface OutputGuardContext {
  canary: string;
  persona: Persona;
  otherEmployeeNames: string[];
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

@Injectable()
export class OutputGuard {
  check(text: string, ctx: OutputGuardContext): GuardDecision {
    if (ctx.canary && text.includes(ctx.canary)) {
      return refusalVerdict('prompt_injection');
    }

    if (ctx.persona === 'employee') {
      for (const name of ctx.otherEmployeeNames) {
        const trimmed = name.trim();
        if (trimmed.length < 3) continue;
        const pattern = escapeRe(trimmed).replace(/\s+/g, '\\s+');
        if (new RegExp(`(?<!\\w)${pattern}(?!\\w)`, 'iu').test(text)) {
          return refusalVerdict('pii_leak');
        }
      }
    }

    if (scanBlocklist(text)) {
      return refusalVerdict('harassment_profanity');
    }

    return { allowed: true };
  }
}
