// Timeoff: full lifecycle — create → pending → approve → delete. Mutation
// endpoints return the refreshed actor-scoped LIST (not the single entity),
// so assertions locate the row inside the returned array.
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2eApp, fetchSeededUsers, KEY, SeededUsers } from './e2e-utils';

interface LeaveRow {
  id: string;
  employee: string;
  type: string;
  start: string;
  status: string;
}

describe('Timeoff (e2e)', () => {
  let app: INestApplication;
  let users: SeededUsers;
  let createdId: string | undefined;

  const START = '2026-09-01';
  const hr = () => ({ 'x-internal-key': KEY, 'x-actor-id': users.hr.id });
  const findMine = (rows: LeaveRow[]) =>
    rows.find((l) => l.employee === users.employee.name && l.start === START && l.type === 'Vacation');

  beforeAll(async () => {
    app = await createE2eApp();
    users = await fetchSeededUsers(app);
  });
  afterAll(async () => {
    if (createdId) {
      await request(app.getHttpServer())
        .delete(`/api/v1/timeoff/leave-requests/${createdId}`)
        .set(hr());
    }
    await app.close();
  });

  it('creates a leave request that lands as Pending', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/timeoff/leave-requests')
      .set(hr())
      .send({
        employeeName: users.employee.name,
        type: 'Vacation',
        start: START,
        end: '2026-09-03',
        days: 3,
      })
      .expect(201);
    // Mutations return the refreshed list.
    expect(Array.isArray(res.body)).toBe(true);
    const mine = findMine(res.body);
    expect(mine).toBeDefined();
    expect(mine!.status).toBe('Pending');
    createdId = mine!.id;
  });

  it('the new request shows up in the list', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/timeoff/leave-requests')
      .set(hr())
      .expect(200);
    expect(res.body.some((l: LeaveRow) => l.id === createdId)).toBe(true);
  });

  it('approver can approve it', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/timeoff/leave-requests/${createdId}/status`)
      .set(hr())
      .send({ status: 'Approved' });
    expect([200, 201]).toContain(res.status);
    const mine = res.body.find((l: LeaveRow) => l.id === createdId);
    expect(mine?.status).toBe('Approved');
  });

  it('rejects an invalid leave type', () => {
    return request(app.getHttpServer())
      .post('/api/v1/timeoff/leave-requests')
      .set(hr())
      .send({
        employeeName: users.employee.name,
        type: 'Sabbatical',
        start: START,
        end: START,
        days: 1,
      })
      .expect(400);
  });

  it('rejects overtime hours beyond the 12h cap', () => {
    return request(app.getHttpServer())
      .post('/api/v1/timeoff/leave-requests')
      .set(hr())
      .send({
        employeeName: users.employee.name,
        type: 'Overtime',
        start: START,
        end: START,
        days: 1,
        hours: 13,
      })
      .expect(400);
  });

  it('HR can delete the request (cleanup path works)', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/timeoff/leave-requests/${createdId}`)
      .set(hr());
    expect([200, 204]).toContain(res.status);
    expect(res.body.some((l: LeaveRow) => l.id === createdId)).toBe(false);
    createdId = undefined;
  });
});
