// Workplace: training-course moderation is HR-gated, letter templates are
// HR-only (seeded by db:seed), and course CRUD round-trips cleanly.
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2eApp, fetchSeededUsers, KEY, SEED_COMPANY_ID, SeededUsers } from './e2e-utils';
import { PrismaService } from '../src/platform/database/prisma.service';

describe('Workplace (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let users: SeededUsers;
  let courseId: string | undefined;
  // Same-named-manager test (below) creates two extra Employees + Users and a
  // LetterTemplate directly in the seeded demo tenant — track their ids so
  // afterAll can remove them and every run doesn't permanently add two more
  // managers to the demo company.
  let patTemplateId: string | undefined;
  let patReporteeId: string | undefined;
  let patMgrAId: string | undefined;
  let patMgrBId: string | undefined;
  const suffix = Date.now().toString(36);

  const as = (userId: string) => ({ 'x-internal-key': KEY, 'x-actor-id': userId });

  beforeAll(async () => {
    app = await createE2eApp();
    prisma = app.get(PrismaService);
    users = await fetchSeededUsers(app);
  });
  afterAll(async () => {
    if (courseId) {
      await request(app.getHttpServer())
        .delete(`/api/v1/workplace/training-courses/${courseId}`)
        .set(as(users.hr.id));
    }
    if (patTemplateId) {
      await prisma.letterTemplate.delete({ where: { id: patTemplateId } });
    }
    // Users cascade-delete with their Employee (schema: onDelete: Cascade),
    // so removing the Employees is enough. Reportee first — it references
    // mgrA via managerId (onDelete: SetNull would otherwise just null it out).
    if (patReporteeId) {
      await prisma.employee.delete({ where: { id: patReporteeId } });
    }
    if (patMgrAId) {
      await prisma.employee.delete({ where: { id: patMgrAId } });
    }
    if (patMgrBId) {
      await prisma.employee.delete({ where: { id: patMgrBId } });
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

  /**
   * Manager reach for letter drafting used to be decided by comparing NAMES
   * (`employee.manager !== actor.employeeName`), so two managers who happen to
   * share a name were interchangeable: the actual reportee's manager (A) and
   * an unrelated same-named manager (B) both matched the comparison. Only the
   * `managerId` relation actually distinguishes them.
   */
  it('a same-named manager who does NOT manage the reportee cannot draft their letter', async () => {
    // The successful draft (A) exercises the full GuardedAgentService path,
    // which attempts and falls back off an unreachable input classifier —
    // slower than this suite's other pure-CRUD assertions.
    const sameName = 'Pat Taylor';
    const mgrA = await prisma.employee.create({
      data: {
        companyId: SEED_COMPANY_ID, name: sameName, title: 'Manager', department: 'Engineering',
        province: 'ON', email: `wl-pat-a-${suffix}@test.com`, hireDate: new Date('2021-01-01'),
        birthDate: new Date('1985-01-01'), salary: 90000,
      },
    });
    const mgrB = await prisma.employee.create({
      data: {
        companyId: SEED_COMPANY_ID, name: sameName, title: 'Manager', department: 'Engineering',
        province: 'ON', email: `wl-pat-b-${suffix}@test.com`, hireDate: new Date('2021-01-01'),
        birthDate: new Date('1985-01-01'), salary: 90000,
      },
    });
    const reportee = await prisma.employee.create({
      data: {
        companyId: SEED_COMPANY_ID, name: 'Reportee WL', title: 'Engineer', department: 'Engineering',
        province: 'ON', email: `wl-report-${suffix}@test.com`, hireDate: new Date('2022-01-01'),
        birthDate: new Date('1990-01-01'), salary: 80000, managerId: mgrA.id,
      },
    });
    patMgrAId = mgrA.id;
    patMgrBId = mgrB.id;
    patReporteeId = reportee.id;
    const userA = await prisma.user.create({ data: { companyId: SEED_COMPANY_ID, employeeId: mgrA.id, role: 'MANAGER' } });
    const userB = await prisma.user.create({ data: { companyId: SEED_COMPANY_ID, employeeId: mgrB.id, role: 'MANAGER' } });
    // Public contract check: the letter payload still carries the manager's
    // NAME (only the internal access check moved to ids) — see letter-merge.ts
    // {{manager_name}} / workplace.types.ts LetterMergeEmployee.manager.
    const template = await prisma.letterTemplate.create({
      data: {
        companyId: SEED_COMPANY_ID, name: `WL manager-name check ${suffix}`,
        category: 'General', body: 'Manager on file: {{manager_name}}',
      },
    });
    patTemplateId = template.id;

    // A actually manages the reportee — must succeed, and the drafted text
    // must carry A's NAME (not an id, not "[object Object]").
    const draftRes = await request(app.getHttpServer())
      .post('/api/v1/workplace/letters/draft')
      .set(as(userA.id))
      .send({ employeeId: reportee.id, templateId: template.id })
      .expect(201);
    expect((draftRes.body as { text: string }).text).toContain(sameName);

    // B shares A's name but manages nobody here — must 404, not succeed.
    // Body is identical to A's request (same templateId) so the only
    // variable between the two calls is who is acting.
    await request(app.getHttpServer())
      .post('/api/v1/workplace/letters/draft')
      .set(as(userB.id))
      .send({ employeeId: reportee.id, templateId: template.id })
      .expect(404);
  }, 20000);
});
