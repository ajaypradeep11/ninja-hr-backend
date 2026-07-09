// Platform: settings round-trip (restored), agent-run lifecycle, calc-rule
// CRUD behind the HR gate, and the copilot's deterministic no-key fallback.
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2eApp, fetchSeededUsers, KEY, SeededUsers } from './e2e-utils';

describe('Platform (e2e)', () => {
  let app: INestApplication;
  let users: SeededUsers;
  let calcRuleId: string | undefined;

  const as = (userId: string) => ({ 'x-internal-key': KEY, 'x-actor-id': userId });

  beforeAll(async () => {
    app = await createE2eApp();
    users = await fetchSeededUsers(app);
  });
  afterAll(async () => {
    if (calcRuleId) {
      await request(app.getHttpServer())
        .delete(`/api/v1/platform/calc-rules/${calcRuleId}`)
        .set(as(users.hr.id));
    }
    await app.close();
  });

  it('settings round-trip: PUT then GET returns what was saved (and restores)', async () => {
    const before = await request(app.getHttpServer())
      .get('/api/v1/platform/settings')
      .set(as(users.hr.id))
      .expect(200);
    const original = before.body;

    const saved = await request(app.getHttpServer())
      .put('/api/v1/platform/settings')
      .set(as(users.hr.id))
      .send({ ...original, companyName: 'E2E Test Co' });
    expect([200, 201]).toContain(saved.status);

    const after = await request(app.getHttpServer())
      .get('/api/v1/platform/settings')
      .set(as(users.hr.id))
      .expect(200);
    expect(after.body.companyName).toBe('E2E Test Co');

    await request(app.getHttpServer())
      .put('/api/v1/platform/settings')
      .set(as(users.hr.id))
      .send(original)
      .expect(200);
  });

  it('agent runs: create then advance status', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/platform/agent-runs')
      .set(as(users.hr.id))
      .send({ intent: 'E2E: draft onboarding checklist' })
      .expect(201);
    // Mutations return the refreshed run list — locate ours by intent.
    const run = created.body.find(
      (r: { intent: string }) => r.intent === 'E2E: draft onboarding checklist',
    );
    expect(run).toBeDefined();

    const advanced = await request(app.getHttpServer())
      .patch(`/api/v1/platform/agent-runs/${run.id}/status`)
      .set(as(users.hr.id))
      .send({ status: 'Completed' });
    expect([200, 201]).toContain(advanced.status);
    const after = advanced.body.find((r: { id: string }) => r.id === run.id);
    expect(after?.status).toBe('Completed');
  });

  it('calc rules are HR-gated and support create/update/delete', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/platform/calc-rules')
      .set(as(users.employee.id))
      .expect(403);

    const list = await request(app.getHttpServer())
      .get('/api/v1/platform/calc-rules')
      .set(as(users.hr.id))
      .expect(200);
    // db:seed installs 3 default rules.
    expect(list.body.length).toBeGreaterThanOrEqual(3);

    const created = await request(app.getHttpServer())
      .post('/api/v1/platform/calc-rules')
      .set(as(users.hr.id))
      .send({
        category: 'Timesheet',
        field: 'e2eHoursWorked',
        operator: '>',
        threshold: 44,
        action: 'overtimeMultiplier',
        value: 1.5,
      })
      .expect(201);
    // Mutations return the refreshed rule list — locate ours by field name.
    const rule = created.body.find((r: { field: string }) => r.field === 'e2eHoursWorked');
    expect(rule).toBeDefined();
    calcRuleId = rule.id;

    const toggled = await request(app.getHttpServer())
      .patch(`/api/v1/platform/calc-rules/${calcRuleId}`)
      .set(as(users.hr.id))
      .send({ active: false });
    expect([200, 201]).toContain(toggled.status);
    const after = toggled.body.find((r: { id: string }) => r.id === calcRuleId);
    expect(after?.active).toBe(false);
  });

  it('copilot answers without an Anthropic key (deterministic fallback)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/platform/copilot/ask')
      .set(as(users.employee.id))
      .send({ question: 'How many vacation days do I have left?' });
    expect([200, 201]).toContain(res.status);
    expect(res.body).toBeTruthy();
  });

  it('copilot rejects an empty question', () => {
    return request(app.getHttpServer())
      .post('/api/v1/platform/copilot/ask')
      .set(as(users.employee.id))
      .send({ question: '' })
      .expect(400);
  });
});
