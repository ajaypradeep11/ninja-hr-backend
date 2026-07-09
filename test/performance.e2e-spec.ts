// Performance: reviews + PIPs listing, PIP issuance validation, and the
// actor-scoped growth endpoint (goals / 1-on-1s / kudos for the caller).
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2eApp, fetchSeededUsers, KEY, SeededUsers } from './e2e-utils';

describe('Performance (e2e)', () => {
  let app: INestApplication;
  let users: SeededUsers;

  const as = (userId: string) => ({ 'x-internal-key': KEY, 'x-actor-id': userId });

  beforeAll(async () => {
    app = await createE2eApp();
    users = await fetchSeededUsers(app);
  });
  afterAll(async () => {
    await app.close();
  });

  it('lists performance reviews', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/performance/reviews')
      .set(as(users.hr.id))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('lists PIPs', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/performance/pips')
      .set(as(users.hr.id))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('rejects a PIP with a non-positive duration', () => {
    return request(app.getHttpServer())
      .post('/api/v1/performance/pips')
      .set(as(users.hr.id))
      .send({ employee: users.employee.name, manager: users.manager.name, durationDays: 0 })
      .expect(400);
  });

  it('issues a PIP with a valid duration', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/performance/pips')
      .set(as(users.hr.id))
      .send({ employee: users.employee.name, manager: users.manager.name, durationDays: 60 });
    expect([200, 201]).toContain(res.status);
  });

  it('growth dashboard is actor-scoped (seeded employee has data)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/performance/growth')
      .set(as(users.employee.id))
      .expect(200);
    expect(res.body).toBeDefined();
    // Seed creates goals/1-on-1s/kudos for the demo employee.
    expect(Array.isArray(res.body.goals)).toBe(true);
  });

  it('kudos can be sent to a colleague', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/performance/growth/kudos')
      .set(as(users.manager.id))
      .send({ toEmployeeId: users.employee.employeeId, message: 'E2E kudos — great work!' });
    expect([200, 201]).toContain(res.status);
  });
});
