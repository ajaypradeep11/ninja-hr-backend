// test/auth.e2e-spec.ts — runs ONLY under test:e2e:auth (emulator env present).
// Exercises the Firebase bearer lane end-to-end against the real Auth
// emulator: InternalKeyGuard verifies the ID token, ActorGuard resolves the
// user by firebaseUid/email, and /identity/me reports the resolved actor.
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2eApp, fetchSeededUsers, mintEmulatorToken, KEY, SeededUsers } from './e2e-utils';

describe('Firebase auth lane (e2e)', () => {
  let app: INestApplication;
  let seeded: SeededUsers;
  let hrEmail: string;

  beforeAll(async () => {
    app = await createE2eApp();
    seeded = await fetchSeededUsers(app);
    // Seeded HR user's employee email — fetch via identity/users' employee join
    // (identity/users returns name/roleCode; resolve email through people endpoint):
    const res = await request(app.getHttpServer())
      .get('/api/v1/people/employees')
      .set('x-internal-key', KEY)
      .set('x-actor-persona', 'admin')
      .expect(200);
    hrEmail = res.body.find((e: { id: string }) => e.id === seeded.hr.employeeId).email;
  });
  afterAll(async () => app.close());

  it('401s with no credentials', () =>
    request(app.getHttpServer()).get('/api/v1/identity/me').expect(401));

  it('401s with a garbage bearer', () =>
    request(app.getHttpServer())
      .get('/api/v1/identity/me')
      .set('authorization', 'Bearer nonsense')
      .expect(401));

  it('403s an authenticated-but-unprovisioned user', async () => {
    const token = await mintEmulatorToken('stranger@nowhere.test');
    await request(app.getHttpServer())
      .get('/api/v1/identity/me')
      .set('authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('resolves a provisioned user by email and stamps firebaseUid', async () => {
    const token = await mintEmulatorToken(hrEmail);
    const res = await request(app.getHttpServer())
      .get('/api/v1/identity/me')
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.id).toBe(seeded.hr.id);
    expect(res.body.roleCode ?? res.body.role).toBe('HR_ADMIN');
  });

  it('HR impersonates an employee; realUserId is preserved', async () => {
    const token = await mintEmulatorToken(hrEmail);
    const res = await request(app.getHttpServer())
      .get('/api/v1/identity/me')
      .set('authorization', `Bearer ${token}`)
      .set('x-actor-id', seeded.employee.id)
      .expect(200);
    expect(res.body.id).toBe(seeded.employee.id);
    expect(res.body.realUserId).toBe(seeded.hr.id);
  });
});
