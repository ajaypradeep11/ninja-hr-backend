// src/platform/auth/inbound-webhook.guard.spec.ts
import { UnauthorizedException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { expectedSignature, InboundWebhookGuard } from './inbound-webhook.guard';

const ctxFor = (req: Record<string, unknown>) =>
  ({ switchToHttp: () => ({ getRequest: () => req }) }) as unknown as ExecutionContext;

const guard = new InboundWebhookGuard();
const BODY = Buffer.from(JSON.stringify({ to: 'reply+tok@mail.x', text: 'hi' }));

let savedSecret: string | undefined;
beforeEach(() => {
  savedSecret = process.env.INBOUND_WEBHOOK_SECRET;
  delete process.env.INBOUND_WEBHOOK_SECRET;
});
afterEach(() => {
  if (savedSecret === undefined) delete process.env.INBOUND_WEBHOOK_SECRET;
  else process.env.INBOUND_WEBHOOK_SECRET = savedSecret;
});

describe('InboundWebhookGuard', () => {
  it('accepts the trusted internal-key lane', () => {
    expect(guard.canActivate(ctxFor({ headers: {}, trusted: true }))).toBe(true);
  });

  it('accepts a valid HMAC signature over the raw body', () => {
    process.env.INBOUND_WEBHOOK_SECRET = 'webhook-secret';
    const sig = expectedSignature('webhook-secret', BODY);
    expect(
      guard.canActivate(ctxFor({ headers: { 'x-webhook-signature': sig }, rawBody: BODY })),
    ).toBe(true);
  });

  it('rejects a signature computed over a DIFFERENT body (tamper detection)', () => {
    process.env.INBOUND_WEBHOOK_SECRET = 'webhook-secret';
    const sig = expectedSignature('webhook-secret', Buffer.from('other payload'));
    expect(() =>
      guard.canActivate(ctxFor({ headers: { 'x-webhook-signature': sig }, rawBody: BODY })),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a signature made with the wrong secret', () => {
    process.env.INBOUND_WEBHOOK_SECRET = 'webhook-secret';
    const sig = expectedSignature('not-the-secret', BODY);
    expect(() =>
      guard.canActivate(ctxFor({ headers: { 'x-webhook-signature': sig }, rawBody: BODY })),
    ).toThrow(UnauthorizedException);
  });

  it('fails closed when no secret is configured — signature lane is OFF, not open', () => {
    const sig = expectedSignature('anything', BODY);
    expect(() =>
      guard.canActivate(ctxFor({ headers: { 'x-webhook-signature': sig }, rawBody: BODY })),
    ).toThrow(UnauthorizedException);
  });

  it('rejects unauthenticated requests outright', () => {
    expect(() => guard.canActivate(ctxFor({ headers: {} }))).toThrow(UnauthorizedException);
  });
});
