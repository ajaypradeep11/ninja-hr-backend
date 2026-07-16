import 'dotenv/config';
process.env.FIREBASE_AUTH_DISABLED ??= '1';
delete process.env.GEMINI_API_KEY;

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/platform/database/prisma.service';
import { createE2eApp, fetchSeededUsers, KEY, SEED_COMPANY_ID, SeededUsers } from './e2e-utils';

describe('Platform policy documents (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let users: SeededUsers;
  const suffix = Date.now().toString(36);
  let companyBId: string;
  let userBId: string;
  let docAId: string;
  let docBId: string;

  const as = (userId: string) => ({ 'x-internal-key': KEY, 'x-actor-id': userId });

  beforeAll(async () => {
    app = await createE2eApp();
    prisma = app.get(PrismaService);
    users = await fetchSeededUsers(app);

    const docA = await prisma.policyDocument.create({
      data: {
        companyId: SEED_COMPANY_ID,
        title: `Alpha Handbook ${suffix}`,
        sourceType: 'text',
        status: 'Failed',
      },
    });
    docAId = docA.id;
    await prisma.policyChunk.create({
      data: {
        documentId: docAId,
        companyId: SEED_COMPANY_ID,
        ordinal: 0,
        heading: 'Vacation',
        text: 'Employees receive 15 vacation days.',
        embedding: [],
      },
    });

    const companyB = await prisma.company.create({
      data: { name: `PolicyBeta ${suffix}`, slug: `policy-beta-${suffix}` },
    });
    companyBId = companyB.id;
    const employeeB = await prisma.employee.create({
      data: {
        companyId: companyBId,
        name: 'Beta Admin',
        title: 'HR Admin',
        department: 'People',
        province: 'ON',
        email: `policy-beta-${suffix}@test.com`,
        hireDate: new Date('2022-01-01'),
        birthDate: new Date('1980-01-01'),
        salary: 100000,
      },
    });
    const userB = await prisma.user.create({
      data: { companyId: companyBId, employeeId: employeeB.id, role: 'HR_ADMIN' },
    });
    userBId = userB.id;
    const docB = await prisma.policyDocument.create({
      data: {
        companyId: companyBId,
        title: `Beta Handbook ${suffix}`,
        sourceType: 'text',
        status: 'Ready',
      },
    });
    docBId = docB.id;
  });

  afterAll(async () => {
    await prisma.policyDocument
      .deleteMany({ where: { id: { in: [docAId, docBId] } } })
      .catch(() => undefined);
    if (companyBId) {
      await prisma.company.delete({ where: { id: companyBId } }).catch(() => undefined);
    }
    await app.close();
  });

  it('is HR-gated', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/platform/policy-documents')
      .set(as(users.employee.id))
      .expect(403);
  });

  it('refuses upload without a live AI provider', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/platform/policy-documents')
      .set(as(users.hr.id))
      .send({ title: 'Employee Manual', sourceType: 'text', text: '# Leave\n\n15 days.' })
      .expect(503);
    expect(String(response.body.message)).toMatch(/GEMINI_API_KEY/);
  });

  it.each([
    { title: 'Employee Manual', sourceType: 'text' },
    { title: 'Employee Manual', sourceType: 'pdf' },
    { title: 'Employee Manual', sourceType: 'docx', text: 'x' },
  ])('validates upload input', async (body) => {
    await request(app.getHttpServer())
      .post('/api/v1/platform/policy-documents')
      .set(as(users.hr.id))
      .send(body)
      .expect(400);
  });

  it('lists only the caller tenant', async () => {
    const responseA = await request(app.getHttpServer())
      .get('/api/v1/platform/policy-documents')
      .set(as(users.hr.id))
      .expect(200);
    expect(responseA.body.map((document: { id: string }) => document.id)).toContain(docAId);
    expect(responseA.body.map((document: { id: string }) => document.id)).not.toContain(docBId);

    const responseB = await request(app.getHttpServer())
      .get('/api/v1/platform/policy-documents')
      .set(as(userBId))
      .expect(200);
    expect(responseB.body.map((document: { id: string }) => document.id)).toContain(docBId);
    expect(responseB.body.map((document: { id: string }) => document.id)).not.toContain(docAId);
  });

  it('does not expose cross-tenant delete or retry', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/platform/policy-documents/${docBId}`)
      .set(as(users.hr.id))
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/platform/policy-documents/${docBId}/retry`)
      .set(as(users.hr.id))
      .expect(404);
  });

  it('rejects retry for a non-Failed document', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/platform/policy-documents/${docBId}/retry`)
      .set(as(userBId))
      .expect(400);
  });

  it('refuses a Failed retry without live AI', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/platform/policy-documents/${docAId}/retry`)
      .set(as(users.hr.id))
      .expect(503);
    expect(String(response.body.message)).toMatch(/GEMINI_API_KEY/);
  });

  it('deletes an owned document and returns the refreshed list', async () => {
    const response = await request(app.getHttpServer())
      .delete(`/api/v1/platform/policy-documents/${docAId}`)
      .set(as(users.hr.id))
      .expect(200);
    expect(response.body.map((document: { id: string }) => document.id)).not.toContain(docAId);
  });
});
