import 'dotenv/config';
// Keep the guard's Firebase lane dormant by default (see test/e2e-utils.ts) —
// this suite drives everything through the trusted internal-key lane.
process.env.FIREBASE_AUTH_DISABLED ??= '1';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { InternalKeyGuard } from '../src/platform/auth/internal-key.guard';
import { FirebaseAdminService } from '../src/platform/auth/firebase-admin.service';
import { SEED_COMPANY_ID } from './e2e-utils';

describe('Onboarding (e2e)', () => {
  let app: INestApplication;
  let key: string;

  beforeAll(async () => {
    key = process.env.INTERNAL_API_KEY ?? 'dev-internal-key';
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalGuards(new InternalKeyGuard(app.get(Reflector), app.get(FirebaseAdminService)));
    await app.init();
    await request(app.getHttpServer())
      .post('/api/v1/onboarding/cases')
      .set('x-internal-key', key)
      .set('x-actor-persona', 'admin')
      .set('x-company-id', SEED_COMPANY_ID)
      .send({ name: 'E2E Seed', province: 'ON', startDate: '2026-08-01', personalEmail: 'e2e-seed@test.com' })
      .expect(201);
  });
  afterAll(async () => { await app.close(); });

  it('rejects requests without the internal key', () => {
    return request(app.getHttpServer()).get('/api/v1/onboarding/cases').expect(401);
  });

  it('lists cases with display-string enums', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/onboarding/cases')
      .set('x-internal-key', key)
      .set('x-actor-persona', 'admin')
      .set('x-company-id', SEED_COMPANY_ID)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    const c = res.body[0];
    expect(['Invited', 'Forms In Progress', 'Pending Verification', 'Ready to Activate', 'Active']).toContain(c.status);
  });

  it('creates a case and returns Invited status', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/onboarding/cases')
      .set('x-internal-key', key)
      .set('x-actor-persona', 'admin')
      .set('x-company-id', SEED_COMPANY_ID)
      .send({ name: 'E2E Tester', province: 'ON', startDate: '2026-08-01', personalEmail: 'e2e@test.com' })
      .expect(201);
    expect(res.body.status).toBe('Invited');
    expect(res.body.checklist.length).toBeGreaterThan(0);
  });

  it('a bare case cannot activate — the activation gates block it (409)', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/onboarding/cases')
      .set('x-internal-key', key)
      .set('x-actor-persona', 'admin')
      .set('x-company-id', SEED_COMPANY_ID)
      .send({ name: 'E2E Gated', province: 'ON', startDate: '2026-08-01', personalEmail: 'e2e-gated@test.com' })
      .expect(201);

    const activateRes = await request(app.getHttpServer())
      .post(`/api/v1/onboarding/cases/${createRes.body.id}/activate`)
      .set('x-internal-key', key)
      .set('x-actor-persona', 'admin')
      .set('x-company-id', SEED_COMPANY_ID)
      .expect(409);
    expect(activateRes.body.message).toContain('Cannot activate');
  });

  it('completing forms + blocking tasks unlocks activation, with an audit entry', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/onboarding/cases')
      .set('x-internal-key', key)
      .set('x-actor-persona', 'admin')
      .set('x-company-id', SEED_COMPANY_ID)
      .send({ name: 'E2E Activate', province: 'ON', startDate: '2026-08-01', personalEmail: 'e2e-activate@test.com' })
      .expect(201);
    const { id, token } = createRes.body as {
      id: string;
      token: string;
      checklist: { id: string; blocking: boolean }[];
    };

    // Gate 1 — the employee completes every onboarding form (by-token wizard).
    for (const formKey of ['personal', 'td1', 'directDeposit', 'benefits', 'handbook']) {
      await request(app.getHttpServer())
        .post(`/api/v1/onboarding/cases/by-token/${token}/forms/${formKey}`)
        .set('x-internal-key', key)
        .set('x-actor-persona', 'employee')
        .expect(201);
    }

    // Gate 2 — HR completes every blocking checklist task.
    for (const task of createRes.body.checklist.filter((t: { blocking: boolean }) => t.blocking)) {
      await request(app.getHttpServer())
        .patch(`/api/v1/onboarding/cases/${id}/tasks/${task.id}`)
        .set('x-internal-key', key)
        .set('x-actor-persona', 'admin')
        .set('x-company-id', SEED_COMPANY_ID)
        .send({ status: 'Completed' })
        .expect(200);
    }

    // Gate 3 (no documents uploaded → nothing pending verification) — activate.
    const activateRes = await request(app.getHttpServer())
      .post(`/api/v1/onboarding/cases/${id}/activate`)
      .set('x-internal-key', key)
      .set('x-actor-persona', 'admin')
      .set('x-company-id', SEED_COMPANY_ID);
    expect([200, 201]).toContain(activateRes.status);

    expect(activateRes.body.status).toBe('Active');
    expect(Array.isArray(activateRes.body.auditLog)).toBe(true);
    const hasActivationAudit = activateRes.body.auditLog.some(
      (entry: { event: string }) => entry.event.includes('Account activated'),
    );
    expect(hasActivationAudit).toBe(true);
  });
});
