import 'dotenv/config';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { InternalKeyGuard } from '../src/platform/auth/internal-key.guard';

describe('Onboarding (e2e)', () => {
  let app: INestApplication;
  const key = process.env.INTERNAL_API_KEY ?? 'dev-internal-key';

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalGuards(new InternalKeyGuard(app.get(Reflector)));
    await app.init();
  });
  afterAll(async () => { await app.close(); });

  it('rejects requests without the internal key', () => {
    return request(app.getHttpServer()).get('/api/v1/onboarding/cases').expect(401);
  });

  it('lists cases with display-string enums', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/onboarding/cases')
      .set('x-internal-key', key)
      .set('x-actor-persona', 'admin')
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length) {
      const c = res.body[0];
      expect(['Invited', 'Forms In Progress', 'Pending Verification', 'Ready to Activate', 'Active']).toContain(c.status);
    }
  });

  it('creates a case and returns Invited status', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/onboarding/cases')
      .set('x-internal-key', key)
      .set('x-actor-persona', 'admin')
      .send({ name: 'E2E Tester', province: 'ON', startDate: '2026-08-01', personalEmail: 'e2e@test.com' })
      .expect(201);
    expect(res.body.status).toBe('Invited');
    expect(res.body.checklist.length).toBeGreaterThan(0);
  });
});
