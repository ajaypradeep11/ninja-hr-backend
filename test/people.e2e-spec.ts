// People (HRIS): the self-or-HR row guard and the self-serve field whitelist
// are the two security-critical behaviors — both enforced in the controller.
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2eApp, fetchSeededUsers, KEY, SeededUsers } from './e2e-utils';

describe('People / HRIS (e2e)', () => {
  let app: INestApplication;
  let users: SeededUsers;

  beforeAll(async () => {
    app = await createE2eApp();
    users = await fetchSeededUsers(app);
  });
  afterAll(async () => {
    await app.close();
  });

  it('HR lists the employee directory', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/people/employees')
      .set('x-internal-key', KEY)
      .set('x-actor-id', users.hr.id)
      .expect(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].name).toBeTruthy();
  });

  it('an employee can read their OWN HRIS record, with SIN/bank masked', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/people/employees/${users.employee.employeeId}`)
      .set('x-internal-key', KEY)
      .set('x-actor-id', users.employee.id)
      .expect(200);
    expect(res.body.name).toBe(users.employee.name);
    // Raw SIN / bank numbers must never leave the API — masked values only.
    const flat = JSON.stringify(res.body);
    expect(flat).not.toMatch(/"sin":"\d{9}"/);
    expect(flat).not.toMatch(/"bankAccount":"\d{7,}"/);
  });

  it("an employee CANNOT read another employee's record", () => {
    return request(app.getHttpServer())
      .get(`/api/v1/people/employees/${users.manager.employeeId}`)
      .set('x-internal-key', KEY)
      .set('x-actor-id', users.employee.id)
      .expect(403);
  });

  it('an employee cannot self-serve HR-only fields (salary)', () => {
    return request(app.getHttpServer())
      .patch(`/api/v1/people/employees/${users.employee.employeeId}`)
      .set('x-internal-key', KEY)
      .set('x-actor-id', users.employee.id)
      .send({ salary: 999999 })
      .expect(403);
  });

  it('an employee CAN self-serve whitelisted contact fields (phone)', async () => {
    const url = `/api/v1/people/employees/${users.employee.employeeId}`;
    const before = await request(app.getHttpServer())
      .get(url)
      .set('x-internal-key', KEY)
      .set('x-actor-id', users.employee.id)
      .expect(200);
    const originalPhone = before.body.phone;

    const res = await request(app.getHttpServer())
      .patch(url)
      .set('x-internal-key', KEY)
      .set('x-actor-id', users.employee.id)
      .send({ phone: '416-555-0000' });
    expect([200, 201]).toContain(res.status);

    // Restore so the dev DB isn't left mutated.
    await request(app.getHttpServer())
      .patch(url)
      .set('x-internal-key', KEY)
      .set('x-actor-id', users.employee.id)
      .send({ phone: originalPhone ?? '416-555-0199' });
  });

  it('headcount aggregates are available', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/people/headcount')
      .set('x-internal-key', KEY)
      .set('x-actor-id', users.hr.id)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
