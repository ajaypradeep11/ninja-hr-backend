// test/e2e-utils.ts — shared bootstrap for e2e specs. Mirrors main.ts wiring
// (prefix, validation pipe, internal-key guard, prisma filter) and resolves
// the seeded demo users so specs can act as HR / manager / employee.
import 'dotenv/config';
// Existing e2e suites drive everything through the trusted internal-key lane
// and have no Firebase emulator to talk to — keep the guard's Firebase lane
// dormant by default so `npm run test:e2e` works without extra setup. Must be
// set before AppModule is imported so the FirebaseAdminService constructor
// (which reads this at construction time) sees it.
process.env.FIREBASE_AUTH_DISABLED ??= '1';

import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { InternalKeyGuard } from '../src/platform/auth/internal-key.guard';
import { FirebaseAdminService } from '../src/platform/auth/firebase-admin.service';
import { PrismaExceptionFilter } from '../src/platform/database/prisma-exception.filter';

export const KEY = process.env.INTERNAL_API_KEY ?? 'dev-internal-key';

export async function createE2eApp(): Promise<INestApplication> {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = mod.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalGuards(new InternalKeyGuard(app.get(Reflector), app.get(FirebaseAdminService)));
  app.useGlobalFilters(new PrismaExceptionFilter());
  await app.init();
  return app;
}

export interface SeededUser {
  id: string;
  employeeId: string;
  name: string;
  roleCode: 'HR_ADMIN' | 'MANAGER' | 'EMPLOYEE';
}

export interface SeededUsers {
  hr: SeededUser;
  manager: SeededUser;
  employee: SeededUser;
}

/** Fetch the seeded demo users (requires `npm run db:seed` to have run). */
export async function fetchSeededUsers(app: INestApplication): Promise<SeededUsers> {
  const res = await request(app.getHttpServer())
    .get('/api/v1/identity/users')
    .set('x-internal-key', KEY)
    .set('x-actor-persona', 'admin')
    .expect(200);
  const users = res.body as SeededUser[];
  const byRole = (role: SeededUser['roleCode']) => users.find((u) => u.roleCode === role);
  const hr = byRole('HR_ADMIN');
  const manager = byRole('MANAGER');
  const employee = byRole('EMPLOYEE');
  if (!hr || !manager || !employee) {
    throw new Error('Seeded users missing — run `npm run db:seed` before the e2e suite.');
  }
  return { hr, manager, employee };
}
