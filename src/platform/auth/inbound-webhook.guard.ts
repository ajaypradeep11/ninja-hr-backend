// src/platform/auth/inbound-webhook.guard.ts
// Auth for the inbound-email webhook (POST /recruitment/comms/inbound).
//
// A mail provider (SendGrid Inbound Parse relay, SES→SNS bridge, …) must NOT
// hold the full-trust internal key just to deliver candidate replies — that
// key can impersonate any user in any tenant. Instead the webhook gets its
// own scoped secret: the sender computes HMAC-SHA256 over the raw request
// body and sends it as `x-webhook-signature: sha256=<hex>`.
//
// Two lanes are accepted, everything else fails closed:
//  - req.trusted (internal key, set by InternalKeyGuard) — keeps the existing
//    server-to-server/demo path working with no new configuration;
//  - a valid HMAC signature under INBOUND_WEBHOOK_SECRET — the lane a real
//    mail provider should use. Unset secret = lane disabled, not lane open.
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

interface WebhookRequest {
  headers: Record<string, string | undefined>;
  trusted?: boolean;
  /** Raw body bytes captured by the json() verify hook in main.ts. */
  rawBody?: Buffer;
}

export function expectedSignature(secret: string, rawBody: Buffer): string {
  return `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
}

@Injectable()
export class InboundWebhookGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<WebhookRequest>();

    // Lane 1 — trusted server-to-server (internal key already verified).
    if (req.trusted === true) return true;

    // Lane 2 — HMAC signature with the webhook's own scoped secret.
    const secret = process.env.INBOUND_WEBHOOK_SECRET;
    const provided = req.headers['x-webhook-signature'];
    if (secret && typeof provided === 'string' && req.rawBody) {
      const a = Buffer.from(provided);
      const b = Buffer.from(expectedSignature(secret, req.rawBody));
      if (a.length === b.length && timingSafeEqual(a, b)) return true;
    }

    throw new UnauthorizedException('invalid webhook credentials');
  }
}
