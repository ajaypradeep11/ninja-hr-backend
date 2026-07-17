import 'dotenv/config';
// Trusted internal-key lane, Firebase dormant (see test/e2e-utils.ts).
process.env.FIREBASE_AUTH_DISABLED ??= '1';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2eApp, fetchSeededUsers, KEY, SEED_COMPANY_ID, SeededUsers } from './e2e-utils';
import { PrismaService } from '../src/platform/database/prisma.service';

/**
 * The core multi-tenancy guarantee: two companies on one deployment never see
 * each other's data. Company A is the seeded demo tenant; Company B is created
 * directly here (raw system client — the legitimate cross-tenant escape hatch)
 * with its own HR admin. We then prove, over the resolved-actor lane, that:
 *  - each company's roster contains only its own employees;
 *  - fetching the other company's employee by id 404s (extended-where-unique);
 *  - an HR_ADMIN cannot impersonate a user in the other company (403).
 */
describe('Tenant isolation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let usersA: SeededUsers;
  const suffix = Date.now().toString(36);
  const bEmail = `beta-admin-${suffix}@test.com`;
  let companyBId: string;
  let empBId: string;
  let userBId: string;

  // Act as a specific user; ActorGuard resolves their company from the id.
  const as = (userId: string) => ({ 'x-internal-key': KEY, 'x-actor-id': userId });

  beforeAll(async () => {
    app = await createE2eApp();
    prisma = app.get(PrismaService);
    usersA = await fetchSeededUsers(app);

    // Company B, provisioned out-of-band with the raw system client.
    const companyB = await prisma.company.create({
      data: { name: `Beta ${suffix}`, slug: `beta-${suffix}` },
    });
    companyBId = companyB.id;
    const empB = await prisma.employee.create({
      data: {
        companyId: companyBId,
        name: 'Beta Admin',
        title: 'HR Admin',
        department: 'People',
        province: 'ON',
        email: bEmail,
        hireDate: new Date('2022-01-01'),
        birthDate: new Date('1980-01-01'),
        salary: 100000,
      },
    });
    empBId = empB.id;
    const userB = await prisma.user.create({
      data: { companyId: companyBId, employeeId: empBId, role: 'HR_ADMIN' },
    });
    userBId = userB.id;
  });

  afterAll(async () => {
    // Cascade-removes Company B's employee + user.
    if (companyBId) await prisma.company.delete({ where: { id: companyBId } }).catch(() => undefined);
    await app.close();
  });

  it('sanity: the two companies are distinct', () => {
    expect(companyBId).not.toBe(SEED_COMPANY_ID);
  });

  it("company A's roster excludes company B's employee", async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/people/employees')
      .set(as(usersA.hr.id))
      .expect(200);
    const emails = (res.body as { email?: string }[]).map((e) => e.email);
    expect(emails).not.toContain(bEmail);
  });

  it("company B's roster contains ONLY its own employee", async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/people/employees')
      .set(as(userBId))
      .expect(200);
    const rows = res.body as { id: string; email?: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe(bEmail);
  });

  it("company A cannot fetch company B's employee by id (404)", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/people/employees/${empBId}`)
      .set(as(usersA.hr.id))
      .expect(404);
  });

  it("company B cannot fetch company A's employee by id (404)", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/people/employees/${usersA.hr.employeeId}`)
      .set(as(userBId))
      .expect(404);
  });

  /**
   * EMP-NNNN numbers are generated per tenant (max of the company's own + 1),
   * so a brand-new company's first hire is always EMP-0001 — the same number
   * the seeded tenant already uses. This regression pins the constraint that
   * has to allow that: while employeeNumber was globally unique, hiring the
   * first employee of ANY new workspace blew up on a collision with an
   * unrelated tenant, which is every new customer's very first hire.
   */
  it('lets a second company reuse EMP-0001 (numbers are per-company)', async () => {
    const takenByA = await prisma.employee.findFirst({
      where: { companyId: SEED_COMPANY_ID, employeeNumber: { not: null } },
      orderBy: { employeeNumber: 'asc' },
      select: { employeeNumber: true },
    });
    expect(takenByA?.employeeNumber).toBe('EMP-0001'); // the number B will also want

    const hire = await request(app.getHttpServer())
      .post('/api/v1/people/employees')
      .set(as(userBId))
      .send({
        name: 'Beta First Hire',
        title: 'Engineer',
        department: 'Engineering',
        province: 'ON',
        email: `beta-hire-${suffix}@test.com`,
        hireDate: '2026-08-01',
        birthDate: '1990-05-05',
      })
      .expect(201);

    const created = await prisma.employee.findUnique({
      where: { id: (hire.body as { id: string }).id },
      select: { employeeNumber: true, companyId: true },
    });
    expect(created?.companyId).toBe(companyBId);
    expect(created?.employeeNumber).toBe('EMP-0001'); // same number, different tenant
  });

  // Note: cross-company impersonation is a FIREBASE-lane concern (a verified
  // HR_ADMIN using x-actor-id) and is covered by the ActorGuard unit spec —
  // the trusted internal-key lane used here acts as the named user directly.

  /**
   * Manager reach used to be decided by comparing NAMES
   * (`employee.manager !== actor.employeeName`), so a manager could draft a
   * letter for the record of an identically-named person's reportee — in
   * another company. The tenant Prisma extension scopes `employee.findUnique`
   * by company, so this cross-company case is expected to already 404
   * regardless of the name-vs-id fix (kept as a belt-and-suspenders pin on
   * that guarantee — see workplace.e2e-spec.ts for the same-company case,
   * which is where the identity bug actually bites).
   */
  it('a same-named manager in another company cannot draft a letter for this one’s reportee', async () => {
    const sameName = 'Pat Taylor';
    // Company A: manager + their reportee.
    const mgrA = await prisma.employee.create({
      data: {
        companyId: SEED_COMPANY_ID, name: sameName, title: 'Manager', department: 'Engineering',
        province: 'ON', email: `pat-a-${suffix}@test.com`, hireDate: new Date('2021-01-01'),
        birthDate: new Date('1985-01-01'), salary: 90000,
      },
    });
    const reportA = await prisma.employee.create({
      data: {
        companyId: SEED_COMPANY_ID, name: 'Reportee A', title: 'Engineer', department: 'Engineering',
        province: 'ON', email: `rep-a-${suffix}@test.com`, hireDate: new Date('2022-01-01'),
        birthDate: new Date('1990-01-01'), salary: 80000, managerId: mgrA.id,
      },
    });
    // Company B: a DIFFERENT person with the same name, managing nobody here.
    const mgrB = await prisma.employee.create({
      data: {
        companyId: companyBId, name: sameName, title: 'Manager', department: 'Engineering',
        province: 'ON', email: `pat-b-${suffix}@test.com`, hireDate: new Date('2021-01-01'),
        birthDate: new Date('1985-01-01'), salary: 90000,
      },
    });
    const userB = await prisma.user.create({
      data: { companyId: companyBId, employeeId: mgrB.id, role: 'MANAGER' },
    });

    await request(app.getHttpServer())
      .post('/api/v1/workplace/letters/draft')
      .set(as(userB.id))
      .send({ employeeId: reportA.id, kind: 'employment_verification' })
      .expect(404);
  });
});
