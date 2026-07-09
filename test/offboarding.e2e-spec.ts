// Offboarding: task listing, status transitions (restored afterwards so the
// dev DB is untouched), and finalize-termination input validation.
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2eApp, fetchSeededUsers, KEY, SeededUsers } from './e2e-utils';

describe('Offboarding (e2e)', () => {
  let app: INestApplication;
  let users: SeededUsers;

  const hr = () => ({ 'x-internal-key': KEY, 'x-actor-id': users.hr.id });

  beforeAll(async () => {
    app = await createE2eApp();
    users = await fetchSeededUsers(app);
  });
  afterAll(async () => {
    await app.close();
  });

  it('lists offboarding tasks', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/offboarding/tasks')
      .set(hr())
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('a task status can transition and back (round-trip)', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/v1/offboarding/tasks')
      .set(hr())
      .expect(200);
    const task = list.body[0];
    if (!task) return; // empty matrix — nothing to transition

    const flipped = task.status === 'Pending' ? 'In-Progress' : 'Pending';
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/offboarding/tasks/${task.id}/status`)
      .set(hr())
      .send({ status: flipped });
    expect([200, 201]).toContain(res.status);
    // Mutations return the refreshed task list.
    const updated = res.body.find((t: { id: string }) => t.id === task.id);
    expect(updated?.status).toBe(flipped);

    await request(app.getHttpServer())
      .patch(`/api/v1/offboarding/tasks/${task.id}/status`)
      .set(hr())
      .send({ status: task.status })
      .expect(200);
  });

  it('rejects an invalid task status', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/v1/offboarding/tasks')
      .set(hr())
      .expect(200);
    const task = list.body[0];
    if (!task) return;
    await request(app.getHttpServer())
      .patch(`/api/v1/offboarding/tasks/${task.id}/status`)
      .set(hr())
      .send({ status: 'Done' })
      .expect(400);
  });

  it('finalize termination requires an employee name', () => {
    return request(app.getHttpServer())
      .post('/api/v1/offboarding/terminate')
      .set(hr())
      .send({})
      .expect(400);
  });
});
