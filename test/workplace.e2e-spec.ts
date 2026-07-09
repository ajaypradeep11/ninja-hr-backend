// Workplace: training-course moderation is HR-gated, letter templates are
// HR-only (seeded by db:seed), and course CRUD round-trips cleanly.
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2eApp, fetchSeededUsers, KEY, SeededUsers } from './e2e-utils';

describe('Workplace (e2e)', () => {
  let app: INestApplication;
  let users: SeededUsers;
  let courseId: string | undefined;

  const as = (userId: string) => ({ 'x-internal-key': KEY, 'x-actor-id': userId });

  beforeAll(async () => {
    app = await createE2eApp();
    users = await fetchSeededUsers(app);
  });
  afterAll(async () => {
    if (courseId) {
      await request(app.getHttpServer())
        .delete(`/api/v1/workplace/training-courses/${courseId}`)
        .set(as(users.hr.id));
    }
    await app.close();
  });

  it('lists training courses', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/workplace/training-courses')
      .set(as(users.employee.id))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('an employee may NOT create an official training course', () => {
    return request(app.getHttpServer())
      .post('/api/v1/workplace/training-courses')
      .set(as(users.employee.id))
      .send({ title: 'E2E Forbidden Course', category: 'Compliance' })
      .expect(403);
  });

  it('HR creates, updates and (afterAll) deletes a training course', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/workplace/training-courses')
      .set(as(users.hr.id))
      .send({ title: 'E2E Safety Course', category: 'Compliance', durationMins: 45 })
      .expect(201);
    // Mutations return the refreshed course list — locate ours by title.
    const mine = created.body.find((c: { title: string }) => c.title === 'E2E Safety Course');
    expect(mine).toBeDefined();
    courseId = mine.id;

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/workplace/training-courses/${courseId}`)
      .set(as(users.hr.id))
      .send({ durationMins: 60 });
    expect([200, 201]).toContain(updated.status);
    const after = updated.body.find((c: { id: string }) => c.id === courseId);
    expect(after?.durationMins).toBe(60);
  });

  it('letter templates are HR-only and include the seeded defaults', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/workplace/letter-templates')
      .set(as(users.employee.id))
      .expect(403);

    const res = await request(app.getHttpServer())
      .get('/api/v1/workplace/letter-templates')
      .set(as(users.hr.id))
      .expect(200);
    const names = res.body.map((t: { name: string }) => t.name);
    expect(names).toEqual(expect.arrayContaining(['Promotion Letter', 'Termination Notice']));
  });

  it('vault documents endpoint responds', () => {
    return request(app.getHttpServer())
      .get('/api/v1/workplace/documents')
      .set(as(users.hr.id))
      .expect(200);
  });
});
