// Auth model: health is the only @Public route; everything else needs the
// internal key, and an unknown x-actor-id must be rejected outright.
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2eApp, KEY } from './e2e-utils';

describe('Health + auth model (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2eApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('GET /health is public (no internal key needed)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body.status).toBeDefined();
  });

  it('protected routes 401 without the internal key', async () => {
    await request(app.getHttpServer()).get('/api/v1/people/employees').expect(401);
    await request(app.getHttpServer()).get('/api/v1/platform/settings').expect(401);
  });

  it('protected routes 401 with a wrong internal key', () => {
    return request(app.getHttpServer())
      .get('/api/v1/people/employees')
      .set('x-internal-key', 'not-the-key')
      .expect(401);
  });

  it('an unknown x-actor-id is rejected as an unknown actor', () => {
    return request(app.getHttpServer())
      .get('/api/v1/people/employees')
      .set('x-internal-key', KEY)
      .set('x-actor-id', 'no-such-user-id')
      .expect(401);
  });
});
