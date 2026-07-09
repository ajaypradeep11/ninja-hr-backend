// Recruitment: role-gating (HR/manager only), the Ontario-only edge rule,
// salary-range validation, and requisition create/read/delete lifecycle.
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2eApp, fetchSeededUsers, KEY, SeededUsers } from './e2e-utils';

describe('Recruitment (e2e)', () => {
  let app: INestApplication;
  let users: SeededUsers;
  let createdId: string | undefined;

  const as = (userId: string) => ({ 'x-internal-key': KEY, 'x-actor-id': userId });

  const validBody = () => ({
    title: 'E2E Test Engineer',
    department: 'Engineering',
    province: 'ON',
    type: 'Full-time',
    salaryMin: 90000,
    salaryMax: 120000,
    approverIds: [],
    hiringTeam: [],
  });

  beforeAll(async () => {
    app = await createE2eApp();
    users = await fetchSeededUsers(app);
  });
  afterAll(async () => {
    if (createdId) {
      await request(app.getHttpServer())
        .delete(`/api/v1/recruitment/requisitions/${createdId}`)
        .set(as(users.hr.id));
    }
    await app.close();
  });

  it('a plain employee is forbidden from the requisition list', () => {
    return request(app.getHttpServer())
      .get('/api/v1/recruitment/requisitions')
      .set(as(users.employee.id))
      .expect(403);
  });

  it('a manager can list requisitions', () => {
    return request(app.getHttpServer())
      .get('/api/v1/recruitment/requisitions')
      .set(as(users.manager.id))
      .expect(200);
  });

  it('HR creates a requisition', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/recruitment/requisitions')
      .set(as(users.hr.id))
      .send(validBody())
      .expect(201);
    createdId = res.body.id;
    expect(res.body.title).toBe('E2E Test Engineer');
  });

  it('rejects a non-Ontario province at the edge', () => {
    return request(app.getHttpServer())
      .post('/api/v1/recruitment/requisitions')
      .set(as(users.hr.id))
      .send({ ...validBody(), province: 'BC' })
      .expect(400);
  });

  it('rejects salaryMax below salaryMin', () => {
    return request(app.getHttpServer())
      .post('/api/v1/recruitment/requisitions')
      .set(as(users.hr.id))
      .send({ ...validBody(), salaryMin: 120000, salaryMax: 90000 })
      .expect(400);
  });

  it('fetches the created requisition detail', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/recruitment/requisitions/${createdId}`)
      .set(as(users.hr.id))
      .expect(200);
    expect(res.body.id).toBe(createdId);
  });

  it('only HR may delete a requisition (manager forbidden)', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/recruitment/requisitions/${createdId}`)
      .set(as(users.manager.id))
      .expect(403);

    const res = await request(app.getHttpServer())
      .delete(`/api/v1/recruitment/requisitions/${createdId}`)
      .set(as(users.hr.id));
    expect([200, 204]).toContain(res.status);
    createdId = undefined;
  });

  it('the public job board endpoint responds (behind the BFF key)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/recruitment/jobs')
      .set(as(users.employee.id))
      .expect(200);
  });
});
