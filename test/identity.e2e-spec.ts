import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2eApp, fetchSeededUsers, KEY, SeededUsers } from './e2e-utils';

describe('Identity (e2e)', () => {
  let app: INestApplication;
  let users: SeededUsers;

  beforeAll(async () => {
    app = await createE2eApp();
    users = await fetchSeededUsers(app);
  });
  afterAll(async () => {
    await app.close();
  });

  it('lists the switchable demo users with all three roles', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/identity/users')
      .set('x-internal-key', KEY)
      .set('x-actor-persona', 'admin')
      .expect(200);
    const roles = res.body.map((u: { roleCode: string }) => u.roleCode);
    expect(roles).toEqual(expect.arrayContaining(['HR_ADMIN', 'MANAGER', 'EMPLOYEE']));
    for (const u of res.body) {
      expect(u.id).toBeTruthy();
      expect(u.employeeId).toBeTruthy();
      expect(u.name).toBeTruthy();
    }
  });

  it('resolves a single user by id', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/identity/users/${users.hr.id}`)
      .set('x-internal-key', KEY)
      .set('x-actor-persona', 'admin')
      .expect(200);
    expect(res.body.roleCode).toBe('HR_ADMIN');
    expect(res.body.name).toBe(users.hr.name);
  });

  it('a real x-actor-id is accepted on protected routes', () => {
    return request(app.getHttpServer())
      .get('/api/v1/identity/users')
      .set('x-internal-key', KEY)
      .set('x-actor-id', users.employee.id)
      .expect(200);
  });
});
