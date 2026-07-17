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
import { TenantContext } from '../src/platform/database/tenant-context';

describe('Onboarding (e2e)', () => {
  let app: INestApplication;
  let key: string;

  beforeAll(async () => {
    key = process.env.INTERNAL_API_KEY ?? 'dev-internal-key';
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    // Per-request tenant store, as main.ts installs it. Without it ActorGuard's
    // tenant.set() throws and every request here 500s.
    const tenant = app.get(TenantContext);
    app.use((_req: unknown, _res: unknown, next: () => void) => tenant.run(null, () => next()));
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

  const admin = () => ({ 'x-internal-key': key, 'x-actor-persona': 'admin', 'x-company-id': SEED_COMPANY_ID });

  /** Create a case, clear every activation gate, activate. Returns the case. */
  async function activateFullCase(name: string, personalEmail: string) {
    const created = await request(app.getHttpServer())
      .post('/api/v1/onboarding/cases')
      .set(admin())
      .send({ name, province: 'ON', startDate: '2026-08-01', personalEmail })
      .expect(201);
    const { id, token, checklist } = created.body as {
      id: string; token: string; checklist: { id: string; blocking: boolean }[];
    };
    for (const formKey of ['personal', 'td1', 'directDeposit', 'benefits', 'handbook']) {
      await request(app.getHttpServer())
        .post(`/api/v1/onboarding/cases/by-token/${token}/forms/${formKey}`)
        .set({ 'x-internal-key': key, 'x-actor-persona': 'employee' })
        .expect(201);
    }
    for (const task of checklist.filter((t) => t.blocking)) {
      await request(app.getHttpServer())
        .patch(`/api/v1/onboarding/cases/${id}/tasks/${task.id}`)
        .set(admin())
        .send({ status: 'Completed' })
        .expect(200);
    }
    const activated = await request(app.getHttpServer())
      .post(`/api/v1/onboarding/cases/${id}/activate`)
      .set(admin());
    expect([200, 201]).toContain(activated.status);
    return activated.body as { id: string; status: string };
  }

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

  /**
   * A second case for someone who already has an Employee row — a rehire, or
   * simply the same person preboarded twice. Provisioning finds the existing
   * employee and links the new case to it, which a UNIQUE employeeId turned
   * into a 500 at activation. One employee may own many cases over time.
   */
  it('a rehire — a second case for an existing employee — still activates', async () => {
    const email = `e2e-rehire-${Date.now().toString(36)}@test.com`;
    const first = await activateFullCase('E2E Rehire', email);
    expect(first.status).toBe('Active');

    const second = await activateFullCase('E2E Rehire', email);
    expect(second.status).toBe('Active');

    // Both cases point at the one employee, and `cases/mine` must serve the
    // NEWEST — the rehire's case, not the stale original.
    expect(second.id).not.toBe(first.id);
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
